"use client";

import React, { createContext, useContext, useCallback, useMemo } from "react";
import { cache } from "react";
import type { Doc } from "@/convex/_generated/dataModel";

interface ThreadsCacheContextValue {
  // Cache management
  getCachedThreads: (key: string) => Doc<"threads">[] | null;
  setCachedThreads: (key: string, threads: Doc<"threads">[]) => void;
  invalidateCache: (key?: string) => void;

  // Cache optimization
  preloadThreads: (key: string, threads: Doc<"threads">[]) => void;
  isCacheValid: (key: string) => boolean;
}

const ThreadsCacheContext = createContext<ThreadsCacheContextValue | null>(
  null,
);

// Global cache using React 19's cache function for optimal performance
const threadsCache = cache(
  () =>
    new Map<
      string,
      {
        threads: Doc<"threads">[];
        timestamp: number;
        expires: number;
      }
    >(),
);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const PRELOAD_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes for preloaded data

export function ThreadsCacheProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get cache for this provider instance
  const cache = threadsCache();

  const getCachedThreads = useCallback(
    (key: string): Doc<"threads">[] | null => {
      const cached = cache.get(key);
      if (cached && Date.now() < cached.expires) {
        return cached.threads;
      }
      // Clean up expired cache entries
      if (cached && Date.now() >= cached.expires) {
        cache.delete(key);
      }
      return null;
    },
    [cache],
  );

  const setCachedThreads = useCallback(
    (key: string, threads: Doc<"threads">[]) => {
      cache.set(key, {
        threads,
        timestamp: Date.now(),
        expires: Date.now() + CACHE_DURATION,
      });
    },
    [cache],
  );

  const preloadThreads = useCallback(
    (key: string, threads: Doc<"threads">[]) => {
      // Preloaded data has shorter cache duration
      cache.set(key, {
        threads,
        timestamp: Date.now(),
        expires: Date.now() + PRELOAD_CACHE_DURATION,
      });
    },
    [cache],
  );

  const isCacheValid = useCallback(
    (key: string): boolean => {
      const cached = cache.get(key);
      return cached ? Date.now() < cached.expires : false;
    },
    [cache],
  );

  const invalidateCache = useCallback(
    (key?: string) => {
      if (key) {
        cache.delete(key);
      } else {
        cache.clear();
      }
    },
    [cache],
  );

  const contextValue = useMemo<ThreadsCacheContextValue>(
    () => ({
      getCachedThreads,
      setCachedThreads,
      invalidateCache,
      preloadThreads,
      isCacheValid,
    }),
    [
      getCachedThreads,
      setCachedThreads,
      invalidateCache,
      preloadThreads,
      isCacheValid,
    ],
  );

  return (
    <ThreadsCacheContext.Provider value={contextValue}>
      {children}
    </ThreadsCacheContext.Provider>
  );
}

export function useThreadsCache() {
  const context = useContext(ThreadsCacheContext);
  if (!context) {
    throw new Error(
      "useThreadsCache must be used within a ThreadsCacheProvider",
    );
  }
  return context;
}
