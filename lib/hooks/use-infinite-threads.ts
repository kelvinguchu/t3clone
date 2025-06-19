"use client";

import { useMemo, useCallback, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";
import { useThreadsCache } from "@/lib/contexts/threads-cache-context";
import type { Doc } from "@/convex/_generated/dataModel";

const ITEMS_PER_PAGE = 30;

export interface UseInfiniteThreadsReturn {
  // Combined data from all pages
  allThreads: Doc<"threads">[];

  // Loading states
  isLoading: boolean;
  isLoadingMore: boolean;

  // Pagination controls
  hasNextPage: boolean;
  loadMore: () => void;

  // Error state
  error: Error | null;

  // Session info
  isAnonymous: boolean;
  sessionId: string | null;

  // Cache management
  refreshCache: () => void;
}

/**
 * Custom hook for infinite scrolling threads using Convex's native pagination
 * with persistent caching to prevent refetching on sidebar state changes
 */
export function useInfiniteThreads(): UseInfiniteThreadsReturn {
  const { isLoaded, user } = useUser();
  const { sessionId, isMigrating, hasMigrated } = useAnonymousSession();
  const { getCachedThreads, setCachedThreads, invalidateCache, isCacheValid } =
    useThreadsCache();

  // Generate cache key based on user/session and migration state
  const cacheKey = useMemo(() => {
    // During migration, keep using session cache until migration completes
    if (user?.id && (!isMigrating || hasMigrated)) {
      return `user:${user.id}`;
    } else if (sessionId) {
      return `session:${sessionId}`;
    } else {
      return "none";
    }
  }, [user?.id, sessionId, isMigrating, hasMigrated]);

  // Track if we've initialized from cache
  const initializedFromCache = useRef(false);
  const lastCacheKey = useRef<string | null>(null);

  // Check if cache key changed (user login/logout or new session)
  const cacheKeyChanged =
    lastCacheKey.current !== null && lastCacheKey.current !== cacheKey;

  useEffect(() => {
    if (cacheKeyChanged) {
      // Clear cache when switching between user/anonymous or different users
      invalidateCache();
      initializedFromCache.current = false;
    }
    lastCacheKey.current = cacheKey;
  }, [cacheKey, cacheKeyChanged, invalidateCache]);

  // Clear cache when migration completes to refresh with claimed threads
  useEffect(() => {
    if (user && hasMigrated && !isMigrating) {
      // Migration just completed, invalidate cache to refresh with user threads
      invalidateCache();
      initializedFromCache.current = false;
    }
  }, [user, hasMigrated, isMigrating, invalidateCache]);

  // Paginated query for authenticated user threads
  const userThreadsQuery = usePaginatedQuery(
    api.threads.getUserThreadsPaginated,
    user?.id ? { userId: user.id } : "skip",
    {
      initialNumItems: ITEMS_PER_PAGE,
    },
  );

  // Paginated query for anonymous threads
  const anonymousThreadsQuery = usePaginatedQuery(
    api.threads.getAnonymousThreadsPaginated,
    sessionId ? { sessionId } : "skip",
    {
      initialNumItems: ITEMS_PER_PAGE,
    },
  );

  // Determine which query to use based on auth state
  // Wait for migration to complete before switching to user query
  const shouldUseUserQuery = user && (!isMigrating || hasMigrated);
  const activeQuery = shouldUseUserQuery
    ? userThreadsQuery
    : anonymousThreadsQuery;

  // Combine all loaded threads from all pages with caching
  const allThreads = useMemo(() => {
    // Always try to get cached data first
    const cachedData = getCachedThreads(cacheKey);

    // If we have cached data, return it immediately (prevents loading flash)
    if (cachedData && cachedData.length > 0) {
      return cachedData;
    }

    // If we have new data from Convex, process and cache it
    if (activeQuery.results) {
      const threads = activeQuery.results.filter(
        (thread): thread is Doc<"threads"> => thread != null,
      );

      // Deduplicate by _id in case a thread appears in multiple queries
      const uniqueThreads = Array.from(
        new Map(threads.map((thread) => [String(thread._id), thread])).values(),
      );

      // Sort by updatedAt/createdAt (most recent first)
      const sortedThreads = uniqueThreads.sort((a, b) => {
        const aTime = a.updatedAt ?? a._creationTime;
        const bTime = b.updatedAt ?? b._creationTime;

        // Check if multiple threads have the same updatedAt (bulk update indicator)
        const timeDiff = Math.abs(aTime - bTime);
        if (timeDiff < 1000) {
          // Within 1 second = likely bulk update
          // For bulk updates, sort by creation time to maintain natural order
          return b._creationTime - a._creationTime;
        }

        // Primary sort by updatedAt/creationTime
        if (bTime !== aTime) {
          return bTime - aTime;
        }

        // Secondary sort by _creationTime (most recent first) when updatedAt is identical
        return b._creationTime - a._creationTime;
      });

      // Cache the processed threads
      setCachedThreads(cacheKey, sortedThreads);

      return sortedThreads;
    }

    // Return empty array if no data available
    return [];
  }, [activeQuery.results, getCachedThreads, setCachedThreads, cacheKey]);

  // Load more function with cache invalidation
  const loadMore = useCallback(() => {
    if (activeQuery.status === "CanLoadMore") {
      // Invalidate cache when loading more to ensure fresh data
      invalidateCache(cacheKey);
      activeQuery.loadMore(ITEMS_PER_PAGE);
    }
  }, [activeQuery, cacheKey, invalidateCache]);

  // Manual cache refresh function
  const refreshCache = useCallback(() => {
    invalidateCache(cacheKey);
    initializedFromCache.current = false;
    // Optionally trigger a refetch here if needed
  }, [cacheKey, invalidateCache]);

  // Derived states with cache consideration
  const cachedData = getCachedThreads(cacheKey);

  // Prioritize showing data immediately - only show loading if we truly have no data
  // Check both allThreads and cached data to prevent flash of loading state
  const hasDataToShow =
    allThreads.length > 0 || (cachedData && cachedData.length > 0);
  const isLoading = !isLoaded || (!hasDataToShow && activeQuery.isLoading);

  const isLoadingMore = activeQuery.status === "LoadingMore";
  const hasNextPage =
    activeQuery.status === "CanLoadMore" ||
    (!isCacheValid(cacheKey) && !activeQuery.results);
  const error = activeQuery.isLoading
    ? null
    : (activeQuery as { error?: Error }).error || null;

  // Derived session info
  const isAnonymous = !user && isLoaded;

  return {
    allThreads,
    isLoading,
    isLoadingMore,
    hasNextPage,
    loadMore,
    error,
    isAnonymous,
    sessionId,
    refreshCache,
  };
}
