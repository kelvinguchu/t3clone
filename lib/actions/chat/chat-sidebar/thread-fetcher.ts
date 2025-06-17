"use client";

import { useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";
import type { Doc } from "@/convex/_generated/dataModel";

export interface ThreadFetcherReturn {
  // Raw thread data
  userThreads: Doc<"threads">[] | undefined;
  anonymousThreads: Doc<"threads">[] | undefined;

  // Combined and processed data
  combinedThreads: Doc<"threads">[];
  threadsData: Doc<"threads">[];

  // Loading states
  threadsLoading: boolean;
  userThreadsLoading: boolean;
  anonymousThreadsLoading: boolean;

  // Session info
  isAnonymous: boolean;
  sessionId: string | null;
  sessionData: { ipHash?: string } | null;
  user: { id: string } | null | undefined;
}

/**
 * Custom hook for fetching and combining threads from both authenticated and anonymous sources
 * Extracted from chat-sidebar.tsx
 */
export function useThreadsFetcher(): ThreadFetcherReturn {
  const { isLoaded, user } = useUser();
  const {
    sessionId,
    sessionData,
    isLoading: anonSessionLoading,
  } = useAnonymousSession();

  // Load user threads from Convex
  const userThreads = useQuery(
    api.threads.getUserThreads,
    user?.id ? { userId: user.id } : "skip",
  );

  // Load anonymous threads from Convex using reactive session ID
  const anonymousThreads = useQuery(
    api.threads.getAnonymousThreads,
    sessionId ? { sessionId } : "skip",
  );

  // Always include anonymous threads; for authenticated users these may be
  // transient until they are claimed/promoted, but should still appear.
  const combinedThreads = useMemo(
    () => [...(userThreads ?? []), ...(anonymousThreads ?? [])],
    [userThreads, anonymousThreads],
  );

  // Deduplicate by _id in case a thread was just promoted from anonymous → user
  const threadsData = useMemo(
    () =>
      Array.from(
        new Map(combinedThreads.map((t) => [String(t._id), t])).values(),
      ),
    [combinedThreads],
  );

  // Determine loading state more accurately:
  // 1. Authenticated users -> wait for userThreads
  // 2. Anonymous users -> wait for the anonymous session to initialise *and* the threads query
  const userThreadsLoading = user ? userThreads === undefined : false;
  const anonymousThreadsLoading = !user
    ? anonSessionLoading || anonymousThreads === undefined
    : false;

  const threadsLoading = userThreadsLoading || anonymousThreadsLoading;

  // Derive session info
  const isAnonymous = !user && isLoaded;

  return {
    userThreads,
    anonymousThreads,
    combinedThreads,
    threadsData,
    threadsLoading,
    userThreadsLoading,
    anonymousThreadsLoading,
    isAnonymous,
    sessionId,
    sessionData,
    user,
  };
}
