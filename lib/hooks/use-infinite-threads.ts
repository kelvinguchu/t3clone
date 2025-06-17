"use client";

import { useMemo, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";
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
}

/**
 * Custom hook for infinite scrolling threads using Convex's native pagination
 * Combines authenticated and anonymous threads with proper infinite loading
 */
export function useInfiniteThreads(): UseInfiniteThreadsReturn {
  const { isLoaded, user } = useUser();
  const { sessionId } = useAnonymousSession();

  // Paginated query for authenticated user threads
  const userThreadsQuery = usePaginatedQuery(
    api.threads.getUserThreadsPaginated,
    user?.id ? { userId: user.id } : "skip",
    { initialNumItems: ITEMS_PER_PAGE },
  );

  // Paginated query for anonymous threads
  const anonymousThreadsQuery = usePaginatedQuery(
    api.threads.getAnonymousThreadsPaginated,
    sessionId ? { sessionId } : "skip",
    { initialNumItems: ITEMS_PER_PAGE },
  );

  // Determine which query to use based on auth state
  const activeQuery = user ? userThreadsQuery : anonymousThreadsQuery;

  // Combine all loaded threads from all pages
  const allThreads = useMemo(() => {
    if (!activeQuery.results) return [];

    // The usePaginatedQuery from Convex returns threads directly in the results array
    // No need to flatMap by page since it's already flattened
    const threads = activeQuery.results.filter(
      (thread): thread is Doc<"threads"> => thread != null,
    );

    // Deduplicate by _id in case a thread appears in multiple queries
    const uniqueThreads = Array.from(
      new Map(threads.map((thread) => [String(thread._id), thread])).values(),
    );

    // Sort by updatedAt/createdAt (most recent first)
    return uniqueThreads.sort((a, b) => {
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
  }, [activeQuery.results]);

  // Load more function
  const loadMore = useCallback(() => {
    if (activeQuery.status === "CanLoadMore") {
      activeQuery.loadMore(ITEMS_PER_PAGE);
    }
  }, [activeQuery]);

  // Derived states
  const isLoading = !isLoaded || activeQuery.isLoading;
  const isLoadingMore = activeQuery.status === "LoadingMore";
  const hasNextPage = activeQuery.status === "CanLoadMore";
  const error = activeQuery.isLoading
    ? null
    : (activeQuery as { error?: Error }).error || null;
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
  };
}
