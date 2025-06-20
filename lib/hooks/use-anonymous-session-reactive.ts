"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api as convexApi } from "@/convex/_generated/api";
import {
  formatRemainingTime,
  type AnonymousSessionData,
  getStoredSessionId,
  storeSessionId,
  removeStoredSessionId,
} from "@/lib/utils/session";
import {
  getBrowserFingerprint,
  getBehaviorTracker,
} from "@/lib/utils/browser-fingerprint";

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

  // Thread claiming state
  isMigrating: boolean;
  hasMigrated: boolean;

  // Trust and behavior
  trustLevel?: string;
  behaviorScore?: number;
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

// Enhanced session creation with fingerprint data
async function createSessionWithFingerprint(
  sessionId?: string,
): Promise<AnonymousSessionData> {
  try {
    // Collect browser fingerprint
    const fingerprint = await getBrowserFingerprint();

    // Get behavioral data
    const behaviorTracker = getBehaviorTracker();
    const behaviorData = behaviorTracker.getBehaviorData();

    // Send to server with fingerprint data
    const response = await fetch("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        fingerprint,
        behaviorData,
      }),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error ?? `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.warn(
      "Failed to create session with fingerprint, falling back to basic session:",
      error,
    );
    // Fallback to basic session creation
    return fetchSession(sessionId);
  }
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
  const [isMigrating, setIsMigrating] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine authentication state with hydration safety
  const isAuthenticated = mounted && userLoaded && !!user;
  const isAnonymous = mounted && userLoaded && !user;

  // Debug logging for authentication state (can be removed in production)
  // console.log("[useAnonymousSessionReactive] Auth state", {
  //   mounted,
  //   userLoaded,
  //   hasUser: !!user,
  //   isAuthenticated,
  //   isAnonymous,
  //   sessionId: sessionData?.sessionId,
  //   isMigrating,
  //   hasMigrated: migrated,
  // });

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

  // Prioritize Convex data over KV data for message counts (more reliable)
  const messageCount = sessionStats?.messageCount ?? 0;
  const remainingMessages = sessionStats?.remainingMessages ?? 10; // Default to full quota

  const canSendMessage = remainingMessages > 0 && !sessionData?.isExpired;

  // Initialize session for anonymous users with localStorage persistence
  const initializeSession = useCallback(async () => {
    if (isAuthenticated || sessionInitialized.current) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // 1. Attempt to restore an existing session ID from localStorage
      const storedSessionId = getStoredSessionId();

      let session: AnonymousSessionData;

      if (storedSessionId) {
        try {
          // Try to fetch the existing session from the server
          session = await fetchSession(storedSessionId);
        } catch (error) {
          // If the stored session is invalid or expired, clean it up
          console.warn(
            "[Session] Stored anonymous session invalid, creating new one",
            error,
          );
          removeStoredSessionId();
          session = await createSessionWithFingerprint();
        }
      } else {
        // No stored session – create a new one with fingerprint data
        session = await createSessionWithFingerprint();
      }

      // Persist the (new or restored) session ID for future reloads
      storeSessionId(session.sessionId);

      setSessionData(session);
      sessionInitialized.current = true;
    } catch (error) {
      console.error("[Session] Failed to initialize anonymous session:", error);
      setSessionData(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Refresh session data from server (more resilient to temporary failures)
  const refreshSession = useCallback(async () => {
    if (isAuthenticated || !sessionData) {
      return;
    }

    try {
      const refreshedSession = await fetchSession(sessionData.sessionId);

      // Update persisted session ID in case the server issued a new one
      if (refreshedSession.sessionId !== sessionData.sessionId) {
        storeSessionId(refreshedSession.sessionId);
      }

      setSessionData(refreshedSession);
    } catch (error) {
      console.warn("[Session] Refresh failed, falling back:", error);

      // If session is no longer valid, purge it so a new one can be created
      removeStoredSessionId();
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

    // Clear local state and persisted storage
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
      // Use live session ID if we still have one in state, otherwise fall back to the
      // persisted ID from localStorage. This handles the case where the page loaded
      // directly while authenticated (no in-memory anonymous session) but localStorage
      // still remembers the previous anonymous ID that needs claiming.
      const anonIdForClaim = sessionData?.sessionId || getStoredSessionId();

      if (!migrated && anonIdForClaim) {
        (async () => {
          setIsMigrating(true);
          try {
            await claimThreads({
              sessionId: anonIdForClaim,
              ...(sessionData?.ipHash ? { ipHash: sessionData.ipHash } : {}),
            });
            // Once claimed, we can safely remove the stored anonymous ID.
            removeStoredSessionId();
          } catch {
            // Failed to claim anon threads
          } finally {
            setMigrated(true);
            setIsMigrating(false);
          }
        })();
      }
      setIsLoading(false);
    }
  }, [
    userLoaded,
    isAnonymous,
    isAuthenticated,
    initializeSession,
    sessionData?.sessionId,
    sessionData?.ipHash,
    claimThreads,
    migrated,
  ]);

  // Periodic session refresh (reduced frequency to 5 minutes)
  useEffect(() => {
    if (!isAnonymous || !sessionData) {
      return;
    }

    const interval = setInterval(
      () => {
        refreshSession();
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [isAnonymous, sessionData, refreshSession]);

  return {
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
    formatRemainingTime: formatTimeRemaining,
    checkCanSendMessage,
    sessionId,
    threadCount,
    isMigrating,
    hasMigrated: migrated,
    trustLevel: sessionData?.trustLevel,
    behaviorScore: sessionData?.behaviorScore,
  };
}
