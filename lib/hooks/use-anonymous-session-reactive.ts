"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api as convexApi } from "@/convex/_generated/api";
import {
  formatRemainingTime,
  type AnonymousSessionData,
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

  // Prioritize Convex data over KV data for message counts (more reliable)
  const messageCount = sessionStats?.messageCount ?? 0;
  const remainingMessages = sessionStats?.remainingMessages ?? 10; // Default to full quota

  const canSendMessage = remainingMessages > 0 && !sessionData?.isExpired;

  // Initialize session for anonymous users with enhanced fingerprinting
  const initializeSession = useCallback(async () => {
    if (isAuthenticated || sessionInitialized.current) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Create session with fingerprint data for enhanced security
      const session = await createSessionWithFingerprint();

      setSessionData(session);
      sessionInitialized.current = true;
    } catch {
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
      setSessionData(refreshedSession);
    } catch (error) {
      // Don't clear session on temporary failures - just log and keep existing session
      console.warn(
        "[Session] Refresh failed, keeping existing session:",
        error,
      );
      // Only clear if session is actually expired (not just network issues)
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

    // Clear local state
    setSessionData(null);
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
      if (!migrated && sessionData?.sessionId) {
        (async () => {
          try {
            await claimThreads({
              sessionId: sessionData.sessionId,
              ...(sessionData?.ipHash ? { ipHash: sessionData.ipHash } : {}),
            });
          } catch {
            // Failed to claim anon threads
          } finally {
            setMigrated(true);
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
    trustLevel: sessionData?.trustLevel,
    behaviorScore: sessionData?.behaviorScore,
  };
}
