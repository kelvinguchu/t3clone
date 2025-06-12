"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAnonymousSession } from "./use-anonymous-session";
import { useAnonymousSessionReactive } from "./use-anonymous-session-reactive";
import type { Id, Doc } from "@/convex/_generated/dataModel";

// Hook return type
export interface UseAnonymousChatReturn {
  // Session state
  isAnonymous: boolean;
  canSendMessage: boolean;
  remainingMessages: number;
  messageCount: number;

  // Chat functionality
  createThread: (title: string) => Promise<Id<"threads"> | null>;
  sendMessage: (threadId: Id<"threads">, content: string) => Promise<boolean>;

  // Thread management
  anonymousThreads: Array<Doc<"threads">> | undefined;
  getThreadMessages: () => void;

  // Loading states
  isCreatingThread: boolean;
  isSendingMessage: boolean;
  isLoadingThreads: boolean;

  // Rate limiting feedback
  getRateLimitWarning: () => string | null;
  formatRemainingMessages: () => string;

  // Error handling
  error: string | null;
  clearError: () => void;
}

// Rate limit warning thresholds
const WARNING_THRESHOLDS = {
  CRITICAL: 2, // Show urgent warning when 2 or fewer messages left
  WARNING: 5, // Show warning when 5 or fewer messages left
};

export function useAnonymousChat(): UseAnonymousChatReturn {
  // Base session hook (KV-backed) – still used for mutation helpers
  const { sessionData, isAnonymous, incrementMessageCount } =
    useAnonymousSession();

  // Reactive stats (Convex-backed) used for live UI updates
  const reactiveSession = useAnonymousSessionReactive();

  const canSendMessage = reactiveSession.canSendMessage;
  const remainingMessages = reactiveSession.remainingMessages;
  const messageCount = reactiveSession.messageCount;

  // Local state
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convex operations
  const createAnonymousThread = useMutation(api.threads.createAnonymousThread);
  const createAnonymousMessage = useMutation(
    api.messages.createAnonymousMessage,
  );

  // Queries for anonymous threads and messages
  const anonymousThreads = useQuery(
    api.threads.getAnonymousThreads,
    sessionData?.sessionId ? { sessionId: sessionData.sessionId } : "skip",
  );

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Create a new thread for anonymous user
  const createThread = useCallback(
    async (title: string): Promise<Id<"threads"> | null> => {
      if (!sessionData || !isAnonymous || !canSendMessage) {
        setError(
          "Cannot create thread: session not available or rate limit exceeded",
        );
        return null;
      }

      try {
        setIsCreatingThread(true);
        clearError();

        const threadId = await createAnonymousThread({
          title: title.trim() || "New Chat",
          sessionId: sessionData.sessionId,
          model: "gemini-2.0-flash", // Default model for anonymous users
        });

        if (threadId) {
          return threadId;
        } else {
          setError("Failed to create thread");
          return null;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create thread";
        setError(errorMessage);
        console.error("Failed to create anonymous thread:", err);
        return null;
      } finally {
        setIsCreatingThread(false);
      }
    },
    [
      sessionData,
      isAnonymous,
      canSendMessage,
      createAnonymousThread,
      clearError,
    ],
  );

  // Send message and increment counter
  const sendMessage = useCallback(
    async (threadId: Id<"threads">, content: string): Promise<boolean> => {
      if (!sessionData || !isAnonymous || !canSendMessage) {
        setError(
          "Cannot send message: session not available or rate limit exceeded",
        );
        return false;
      }

      if (!content.trim()) {
        setError("Message content cannot be empty");
        return false;
      }

      try {
        setIsSendingMessage(true);
        clearError();

        // First increment the message count (this handles rate limiting)
        await incrementMessageCount();

        // Then create the message
        const messageId = await createAnonymousMessage({
          threadId,
          content: content.trim(),
          sessionId: sessionData.sessionId,
        });

        if (messageId) {
          return true;
        } else {
          setError("Failed to send message");
          return false;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);
        console.error("Failed to send anonymous message:", err);
        return false;
      } finally {
        setIsSendingMessage(false);
      }
    },
    [
      sessionData,
      isAnonymous,
      canSendMessage,
      incrementMessageCount,
      createAnonymousMessage,
      clearError,
    ],
  );

  // Get messages for a specific thread
  const getThreadMessages = useCallback(() => {
    // This would typically be a separate query hook in the component that needs messages
    // For now, we return undefined and let the component handle the query
  }, []);

  // Generate rate limit warning message
  const getRateLimitWarning = useCallback((): string | null => {
    if (!isAnonymous || !sessionData) return null;

    if (remainingMessages <= 0) {
      return "You've reached your message limit! Sign up for unlimited messaging.";
    }

    if (remainingMessages <= WARNING_THRESHOLDS.CRITICAL) {
      return `Only ${remainingMessages} message${remainingMessages === 1 ? "" : "s"} left! Consider signing up for unlimited access.`;
    }

    if (remainingMessages <= WARNING_THRESHOLDS.WARNING) {
      return `${remainingMessages} messages remaining in your session.`;
    }

    return null;
  }, [isAnonymous, sessionData, remainingMessages]);

  // Format remaining messages for display
  const formatRemainingMessages = useCallback((): string => {
    if (!isAnonymous) return "";

    return `${remainingMessages}/10 messages remaining`;
  }, [isAnonymous, remainingMessages]);

  // Computed values
  const isLoadingThreads = !anonymousThreads && isAnonymous && !!sessionData;

  // Combined error from chat operations
  const combinedError = error;

  return {
    // Session state
    isAnonymous,
    canSendMessage,
    remainingMessages,
    messageCount,

    // Chat functionality
    createThread,
    sendMessage,

    // Thread management
    anonymousThreads,
    getThreadMessages,

    // Loading states
    isCreatingThread,
    isSendingMessage,
    isLoadingThreads,

    // Rate limiting feedback
    getRateLimitWarning,
    formatRemainingMessages,

    // Error handling
    error: combinedError,
    clearError,
  };
}

// Helper hook for getting messages for a specific thread
export function useAnonymousThreadMessages(
  threadId: Id<"threads"> | null,
  sessionId?: string,
) {
  return useQuery(
    api.messages.getThreadMessages,
    threadId && sessionId ? { threadId, sessionId } : "skip",
  );
}

// Helper hook for anonymous thread count
export function useAnonymousThreadCount(sessionId?: string) {
  return useQuery(
    api.threads.getAnonymousThreadCount,
    sessionId ? { sessionId } : "skip",
  );
}
