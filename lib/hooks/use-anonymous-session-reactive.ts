"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api as convexApi } from "@/convex/_generated/api";
import {
  formatRemainingTime,
  getStoredSessionId,
  removeStoredSessionId,
  storeSessionId,
  type AnonymousSessionData,
} from "@/lib/utils/session";

// Enhanced hook return type with Convex integration
export interface UseAnonymousSessionReactiveReturn {
  // Session state
  sessionData: AnonymousSessionData | null;
  isAnonymous: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Rate limiting
  canSendMessage: boolean;
  remainingMessages: number;
  messageCount: number;

  // Actions
  initializeSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearSession: () => Promise<void>;

  // Utilities
  formatRemainingTime: () => string;
  checkCanSendMessage: () => Promise<boolean>;

  // Convex integration
  sessionId: string | null;
  threadCount: number;
}

// API helper functions for server-side session management
async function fetchSession(sessionId?: string): Promise<AnonymousSessionData> {
  const url = sessionId
    ? `/api/session?sessionId=${encodeURIComponent(sessionId)}`
    : "/api/session";

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error ?? `HTTP ${response.status}`);
  }

  return response.json();
}

export function useAnonymousSessionReactive(): UseAnonymousSessionReactiveReturn {
  const { user, isLoaded: userLoaded } = useUser();
  const [sessionData, setSessionData] = useState<AnonymousSessionData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const sessionInitialized = useRef(false);
  const claimThreads = useMutation(convexApi.threads.claimAnonymousThreads);
  const [migrated, setMigrated] = useState(false);

  // Determine authentication state
  const isAuthenticated = userLoaded && !!user;
  const isAnonymous = userLoaded && !user;

  // Extract session ID for use in Convex queries
  const sessionId = sessionData?.sessionId ?? null;

  // --- Convex reactive stats -------------------------------------------------
  // Live stats for the current anonymous session (threads / messages / remaining)
  const sessionStats = useQuery(
    convexApi.sessionStats.getAnonymousSessionStats,
    sessionId ? { sessionId } : "skip",
  );

  // Fallback thread count if stats are not yet ready (first load)
  const fallbackThreadCount = useQuery(
    convexApi.threads.getAnonymousThreadCount,
    sessionId ? { sessionId } : "skip",
  );

  const threadCount = sessionStats?.threadCount ?? fallbackThreadCount ?? 0;

  // Derive counts – prefer live stats, fall back to KV session data while loading
  const messageCount =
    sessionStats?.messageCount ?? sessionData?.messageCount ?? 0;
  const remainingMessages =
    sessionStats?.remainingMessages ?? sessionData?.remainingMessages ?? 0;

  const canSendMessage = remainingMessages > 0 && !sessionData?.isExpired;

  // Initialize session for anonymous users
  const initializeSession = useCallback(async () => {
    if (isAuthenticated || sessionInitialized.current) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Try to get existing session from localStorage first
      const storedSessionId = getStoredSessionId();

      const session = await fetchSession(storedSessionId ?? undefined);

      // Store session ID if it's new
      if (session.sessionId !== storedSessionId) {
        storeSessionId(session.sessionId);
      }

      setSessionData(session);
      sessionInitialized.current = true;
    } catch {
      setSessionData(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Refresh session data from server
  const refreshSession = useCallback(async () => {
    if (isAuthenticated || !sessionData) {
      return;
    }

    try {
      const refreshedSession = await fetchSession(sessionData.sessionId);
      setSessionData(refreshedSession);
    } catch {
      // If session is invalid, clear it
      setSessionData(null);
      removeStoredSessionId();
      sessionInitialized.current = false;
    }
  }, [isAuthenticated, sessionData]);

  // Clear session
  const clearSession = useCallback(async () => {
    if (sessionData) {
      try {
        await fetch(
          `/api/session?sessionId=${encodeURIComponent(sessionData.sessionId)}`,
          {
            method: "DELETE",
          },
        );
      } catch {
        // Failed to delete session from server
      }
    }

    // Clear local state and storage
    setSessionData(null);
    removeStoredSessionId();
    sessionInitialized.current = false;
  }, [sessionData]);

  // Check if user can send a message (with rate limiting)
  const checkCanSendMessage = useCallback(async (): Promise<boolean> => {
    if (isAuthenticated) {
      return true; // Authenticated users have different limits
    }

    if (!sessionData || !canSendMessage) {
      return false;
    }

    // For anonymous users, check session limits
    return canSendMessage;
  }, [isAuthenticated, sessionData, canSendMessage]);

  // Format remaining time
  const formatTimeRemaining = useCallback((): string => {
    if (!sessionData) {
      return "No session";
    }
    return formatRemainingTime(sessionData);
  }, [sessionData]);

  // Initialize session when component mounts and user loads
  useEffect(() => {
    if (userLoaded && isAnonymous && !sessionInitialized.current) {
      initializeSession();
    } else if (userLoaded && isAuthenticated) {
      if (!migrated) {
        const sid = sessionData?.sessionId ?? getStoredSessionId();
        if (sid) {
          (async () => {
            try {
              await claimThreads({
                sessionId: sid,
                ...(sessionData?.ipHash ? { ipHash: sessionData.ipHash } : {}),
              });
            } catch {
              // Failed to claim anon threads
            } finally {
              // Keep the anonymous sessionId in localStorage so that if the user
              // signs out within 24 h, we can continue tracking their remaining
              // anonymous message quota instead of resetting it to a fresh 10.
              setMigrated(true);
            }
          })();
        }
      }
      setIsLoading(false);
    }
  }, [
    userLoaded,
    isAnonymous,
    isAuthenticated,
    initializeSession,
    sessionData,
    clearSession,
    claimThreads,
    migrated,
  ]);

  // Check for existing session on mount (from localStorage)
  useEffect(() => {
    if (userLoaded && isAnonymous && !sessionInitialized.current) {
      const storedSessionId = getStoredSessionId();
      if (storedSessionId) {
        // Try to restore session from server
        fetchSession(storedSessionId)
          .then((session) => {
            if (session) {
              setSessionData(session);
              sessionInitialized.current = true;
            } else {
              // Session expired, create new one
              initializeSession();
            }
          })
          .catch(() => {
            // Error fetching session, create new one
            initializeSession();
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        // No stored session, create new one
        initializeSession();
      }
    }
  }, [userLoaded, isAnonymous, initializeSession]);

  // Auto-refresh session data every 10 seconds for anonymous users
  useEffect(() => {
    if (!isAnonymous || !sessionData) {
      return;
    }

    const refreshInterval = setInterval(() => {
      refreshSession();
    }, 10000); // 10 seconds for more responsive updates

    return () => clearInterval(refreshInterval);
  }, [isAnonymous, sessionData, refreshSession]);

  // Reset migration flag whenever anonymous sessionId changes
  useEffect(() => {
    setMigrated(false);
  }, [sessionId]);

  const memoizedReturn = useMemo(
    () => ({
      // Session state
      sessionData,
      isAnonymous,
      isAuthenticated,
      isLoading,

      // Rate limiting
      canSendMessage,
      remainingMessages,
      messageCount,

      // Actions
      initializeSession,
      refreshSession,
      clearSession,

      // Utilities
      formatRemainingTime: formatTimeRemaining,
      checkCanSendMessage,

      // Convex integration
      sessionId,
      threadCount,
    }),
    [
      sessionData,
      isAnonymous,
      isAuthenticated,
      isLoading,
      canSendMessage,
      remainingMessages,
      messageCount,
      initializeSession,
      refreshSession,
      clearSession,
      formatTimeRemaining,
      checkCanSendMessage,
      sessionId,
      threadCount,
    ],
  );

  return memoizedReturn;
}
