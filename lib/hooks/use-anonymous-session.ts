"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import {
  formatRemainingTime,
  getStoredSessionId,
  removeStoredSessionId,
  storeSessionId,
  type AnonymousSessionData,
} from "@/lib/utils/session";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

// Hook return type
export interface UseAnonymousSessionReturn {
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
  incrementMessageCount: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearSession: () => Promise<void>;

  // Utilities
  formatRemainingTime: () => string;
  checkCanSendMessage: () => Promise<boolean>;
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

async function incrementSessionMessages(
  sessionId: string,
): Promise<AnonymousSessionData> {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

async function deleteSessionAPI(sessionId: string): Promise<void> {
  const response = await fetch(
    `/api/session?sessionId=${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
}

export function useAnonymousSession(): UseAnonymousSessionReturn {
  const { user, isLoaded: userLoaded } = useUser();
  const claimThreads = useMutation(api.threads.claimAnonymousThreads);
  const [sessionData, setSessionData] = useState<AnonymousSessionData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const sessionInitialized = useRef(false);
  const [migrated, setMigrated] = useState(false);

  // Determine authentication state
  const isAuthenticated = userLoaded && !!user;
  const isAnonymous = userLoaded && !user;

  // Calculate derived values
  const canSendMessage = sessionData
    ? sessionData.remainingMessages > 0 && !sessionData.isExpired
    : false;
  const remainingMessages = sessionData?.remainingMessages ?? 0;
  const messageCount = sessionData?.messageCount ?? 0;

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

      const session = await fetchSession(storedSessionId || undefined);

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

  // Increment message count
  const incrementMessageCount = useCallback(async () => {
    if (isAuthenticated || !sessionData) {
      throw new Error(
        "Cannot increment message count: not an anonymous session",
      );
    }

    if (!canSendMessage) {
      throw new Error("Message limit exceeded");
    }

    try {
      const updatedSession = await incrementSessionMessages(
        sessionData.sessionId,
      );
      setSessionData(updatedSession);
    } catch (error) {
      console.error("Failed to increment message count:", error);
      throw error;
    }
  }, [isAuthenticated, sessionData, canSendMessage]);

  // Clear session
  const clearSession = useCallback(async () => {
    if (sessionData) {
      try {
        await deleteSessionAPI(sessionData.sessionId);
      } catch (error) {
        console.error("Failed to delete session from server:", error);
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
      if (sessionData && !migrated) {
        // Migrate threads then clear session
        claimThreads({ sessionId: sessionData.sessionId })
          .catch(() => {
            // Failed to claim threads
          })
          .finally(() => {
            clearSession();
            setMigrated(true);
          });
      } else {
        setIsLoading(false);
      }
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

  // Periodic session refresh (every 30 seconds)
  useEffect(() => {
    if (!isAnonymous || !sessionData) {
      return;
    }

    const refreshInterval = setInterval(() => {
      refreshSession();
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [isAnonymous, sessionData, refreshSession]);

  return {
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
    incrementMessageCount,
    refreshSession,
    clearSession,

    // Utilities
    formatRemainingTime: formatTimeRemaining,
    checkCanSendMessage,
  };
}
