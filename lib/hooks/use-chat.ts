"use client";

import { useChat as useVercelAIChat, type Message } from "@ai-sdk/react";
import type { JSONValue } from "ai";
import { useAnonymousSession } from "./use-anonymous-session";
import { type ModelId } from "@/lib/ai-providers";
import { useState, useCallback, useRef } from "react";
import { handleChatError, shouldAutoRetry } from "@/lib/utils/error-handler";

interface UseChatProps {
  modelId: ModelId;
  initialThreadId?: string | null;
  onError?: (error: Error) => void;
  initialMessages?: Message[];
  // AI SDK Performance Options
  experimental_throttle?: number;
  sendExtraMessageFields?: boolean;
  experimental_prepareRequestBody?: ({
    messages,
    id,
  }: {
    messages: Message[];
    id?: string;
  }) => Record<string, unknown>;
}

export function useChat({
  modelId,
  initialThreadId = null,
  onError,
  initialMessages,
  experimental_throttle = 50, // Default to 50ms throttling for performance
  sendExtraMessageFields = false, // Default to false for performance
  experimental_prepareRequestBody,
}: UseChatProps) {
  // Generate a stable random ID only once per hook instance to avoid log spam
  const hookIdRef = useRef<string | null>(null);
  if (!hookIdRef.current) {
    hookIdRef.current = `hook-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
  }
  const hookId = hookIdRef.current;

  const { sessionData, isAnonymous, refreshSession } = useAnonymousSession();

  // Persist thread ID across messages so server doesn't create a new thread each time
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [currentAttachmentIds, setCurrentAttachmentIds] = useState<string[]>(
    [],
  );

  const requestBody = {
    modelId,
    // Include threadId so the backend appends to existing conversation
    ...(threadId && { threadId }),
    // Include attachment IDs if present
    ...(currentAttachmentIds.length > 0 && {
      attachmentIds: currentAttachmentIds,
    }),
  };

  const requestHeaders = {
    ...(sessionData && { "X-Session-ID": sessionData.sessionId }),
    ...(threadId && { "X-Thread-Id": threadId }),
  };

  // Optimized request body preparation for performance
  const optimizedPrepareRequestBody = useCallback(
    experimental_prepareRequestBody ||
      (({
        messages,
        id,
        requestBody,
      }: {
        messages: Message[];
        id: string;
        requestData?: JSONValue;
        requestBody?: object;
      }) => {
        // Send all messages as expected by the API route
        const finalRequestBody: Record<string, unknown> = {
          messages,
          id,
          modelId,
          ...(threadId && { threadId }),
          ...(currentAttachmentIds.length > 0 && {
            attachmentIds: currentAttachmentIds,
          }),
          // Include any additional body properties from requestBody (like enableWebBrowsing)
          // This is critical for web browsing functionality
          ...(requestBody as Record<string, unknown>),
        };

        return finalRequestBody;
      }),
    [
      experimental_prepareRequestBody,
      modelId,
      threadId,
      currentAttachmentIds,
      hookId,
    ],
  );

  // Enhanced callbacks for immediate UI feedback
  const handleResponse = useCallback(
    (response: Response) => {
      // Handle rate limiting headers
      const newThreadId = response.headers.get("X-Thread-Id");

      if (newThreadId) {
        setThreadId(newThreadId);
      }
    },
    [hookId],
  );

  const handleFinish = useCallback(
    async (message: Message) => {
      // Extract reasoning from message parts for logging purposes
      let reasoning: string | undefined;
      const messageWithParts = message as Message & {
        parts?: Array<{
          type: string;
          reasoning?: string;
        }>;
      };

      if (messageWithParts.parts) {
        const reasoningParts = messageWithParts.parts.filter(
          (part) => part.type === "reasoning",
        );
        if (reasoningParts.length > 0) {
          reasoning = reasoningParts
            .map((part) => part.reasoning || "")
            .join("\n");
        }
      }

      // Also check direct reasoning property (fallback)
      const messageWithReasoning = message as Message & { reasoning?: string };
      if (!reasoning && messageWithReasoning.reasoning) {
        reasoning = messageWithReasoning.reasoning;
      }

      // Note: We don't update the database here because:
      // 1. AI SDK message IDs are not valid Convex IDs
      // 2. Reasoning should be saved server-side during the streaming process
      // 3. The onFinish callback is for client-side logic only

      // Clear attachment IDs after message is sent
      setCurrentAttachmentIds([]);

      // Refresh session data for anonymous users to get updated message count
      if (isAnonymous && sessionData) {
        refreshSession();
      }
    },
    [hookId, isAnonymous, sessionData, refreshSession, threadId],
  );

  const handleError = useCallback(
    (error: Error) => {
      console.error(`[${hookId}] USECHAT - onError called:`, {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      // Handle the error with user-friendly feedback (without retry for now)
      handleChatError(error);

      onError?.(error);
    },
    [hookId, onError],
  );

  const chat = useVercelAIChat({
    id: threadId ?? undefined,
    api: "/api/chat",
    // Use text protocol for Groq models to fix streaming hangs
    // But use data protocol for reasoning models to enable reasoning extraction
    streamProtocol:
      modelId === "llama3-70b-8192"
        ? "text"
        : modelId === "deepseek-r1-distill-llama-70b" ||
            modelId === "qwen/qwen3-32b"
          ? "data" // reasoning models need data protocol for reasoning extraction
          : "data",
    initialMessages,
    body: requestBody,
    headers: requestHeaders,
    // Enable multi-step tool execution
    maxSteps: 5,
    // Performance optimizations
    experimental_throttle, // Throttle UI updates to prevent excessive re-renders
    sendExtraMessageFields, // Only send essential fields for performance
    experimental_prepareRequestBody: optimizedPrepareRequestBody,
    // Enhanced callbacks for immediate feedback
    onResponse: handleResponse,
    onFinish: handleFinish,
    onError: handleError,
  });

  // Enhanced error handler with retry functionality (after chat is defined)
  const handleErrorWithRetry = useCallback(
    (error: Error) => {
      const parsedError = handleChatError(error, () => {
        // Retry function - reload the chat
        chat.reload?.();
      });

      // Check if we should auto-retry for certain error types
      if (shouldAutoRetry(parsedError)) {
        setTimeout(() => {
          chat.reload?.();
        }, 2000); // Auto-retry after 2 seconds for network/server errors
      }
    },
    [chat],
  );

  return {
    ...chat,
    modelId,
    isAnonymous,
    threadId,
    // Expose experimental_resume for resumable streams
    experimental_resume: chat.experimental_resume,
    // Enhanced loading state using built-in status
    isLoading: chat.status === "submitted" || chat.status === "streaming",
    // Expose status for granular UI control
    status: chat.status,
    // Add convenient method for sending messages with optional attachment IDs or experimental attachments
    sendMessage: async (
      content: string,
      attachmentIds?: string[],
      options?: {
        experimental_attachments?: Array<{
          name: string;
          contentType: string;
          url: string;
        }>;
        enableWebBrowsing?: boolean;
      },
    ) => {
      if (
        !content.trim() &&
        (!attachmentIds || attachmentIds.length === 0) &&
        !options?.experimental_attachments?.length
      ) {
        return;
      }

      try {
        if (options?.experimental_attachments?.length) {
          // Build extra request body to ensure attachmentIds and flags are included
          const appendOptions: {
            body: Record<string, unknown>;
          } = {
            body: {},
          };

          if (attachmentIds && attachmentIds.length > 0) {
            appendOptions.body.attachmentIds = attachmentIds;
            // Keep local state so subsequent sends work
            setCurrentAttachmentIds(attachmentIds);
          }

          if (options?.enableWebBrowsing) {
            appendOptions.body.enableWebBrowsing = true;
          }

          chat.append(
            {
              role: "user",
              content: content.trim(),
              experimental_attachments: options.experimental_attachments,
            },
            appendOptions,
          );

          // Clear the input afterwards
          chat.setInput("");
        } else {
          // Build request body for regular message
          const appendOptions: {
            body: Record<string, unknown>;
          } = {
            body: {},
          };

          if (options?.enableWebBrowsing) {
            appendOptions.body.enableWebBrowsing = true;
          }

          chat.append(
            {
              role: "user",
              content: content.trim(),
            },
            appendOptions,
          );
        }
      } catch (error) {
        // Handle send message errors with user feedback
        if (error instanceof Error) {
          handleErrorWithRetry(error);
        }
      }
    },
  };
}
