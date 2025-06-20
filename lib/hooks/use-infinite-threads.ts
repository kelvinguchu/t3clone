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
    // 1. Always prefer fresh data from Convex when available
    if (activeQuery.results) {
      const threads = activeQuery.results.filter(
        (thread): thread is Doc<"threads"> => thread != null,
      );

      const uniqueThreads = Array.from(
        new Map(threads.map((t) => [String(t._id), t])).values(),
      );

      const sortedThreads = uniqueThreads.sort((a, b) => {
        const aTime = a.updatedAt ?? a._creationTime;
        const bTime = b.updatedAt ?? b._creationTime;

        if (Math.abs(aTime - bTime) < 1000) {
          return b._creationTime - a._creationTime;
        }

        return bTime - aTime;
      });

      // Update cache so future renders start with the latest data
      setCachedThreads(cacheKey, sortedThreads);

      return sortedThreads;
    }

    // 2. Fall back to cached data to avoid loading flash while query resolves
    const cachedData = getCachedThreads(cacheKey);
    if (cachedData && cachedData.length > 0) {
      return cachedData;
    }

    // 3. Nothing yet
    return [];
  }, [activeQuery.results, cacheKey, getCachedThreads, setCachedThreads]);

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
