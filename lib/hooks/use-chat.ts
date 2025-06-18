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

  // Track partial content for stop-with-save functionality
  const [isSavingPartial, setIsSavingPartial] = useState(false);
  const lastMessageRef = useRef<Message | null>(null);
  const lastRequestDataRef = useRef<{
    messages: Message[];
    attachmentIds: string[];
  } | null>(null);

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
    // Use 'data' protocol for tool calls and reasoning support
    // The backend will handle the appropriate response format
    streamProtocol: "data",
    initialMessages,
    body: requestBody,
    headers: requestHeaders,
    // Enable multi-step tool execution (increased for complex tool chains)
    maxSteps: 10,
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

  // Save partial content to database
  const savePartialContent = useCallback(
    async (
      content: string,
      messages: Message[],
      attachmentIds: string[] = [],
    ) => {
      if (!content.trim()) return;

      setIsSavingPartial(true);
      try {
        const response = await fetch("/api/chat/partial-save", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionData && { "X-Session-ID": sessionData.sessionId }),
            ...(threadId && { "X-Thread-Id": threadId }),
          },
          body: JSON.stringify({
            messages,
            modelId,
            threadId,
            partialContent: content,
            attachmentIds,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to save partial content: ${response.statusText}`,
          );
        }

        const result = await response.json();

        // Update thread ID if we got a new one
        if (result.threadId && !threadId) {
          setThreadId(result.threadId);
        }

        console.log(`[${hookId}] Partial content saved successfully:`, {
          contentLength: content.length,
          threadId: result.threadId,
        });
      } catch (error) {
        console.error(`[${hookId}] Failed to save partial content:`, error);
        // Don't throw - partial save failure shouldn't break the UI
      } finally {
        setIsSavingPartial(false);
      }
    },
    [hookId, sessionData, threadId, modelId],
  );

  // Enhanced stop function that saves partial content before stopping
  const stopWithSave = useCallback(async () => {
    // Get the current partial content from the last assistant message
    const currentMessages = chat.messages;
    const lastMessage = currentMessages[currentMessages.length - 1];

    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      lastMessage.content
    ) {
      console.log(`[${hookId}] Stopping with partial save:`, {
        contentLength: lastMessage.content.length,
        threadId,
      });

      // Save partial content before stopping
      const messagesToSave =
        lastRequestDataRef.current?.messages || currentMessages.slice(0, -1);
      const attachmentIds = lastRequestDataRef.current?.attachmentIds || [];

      await savePartialContent(
        lastMessage.content,
        messagesToSave,
        attachmentIds,
      );
    }

    // Stop the stream
    chat.stop?.();

    // Clear partial content tracking
    lastMessageRef.current = null;
    lastRequestDataRef.current = null;
  }, [chat, hookId, threadId, savePartialContent]);

  // Track messages for partial save context
  const trackMessageForPartialSave = useCallback(
    (messages: Message[], attachmentIds: string[] = []) => {
      lastRequestDataRef.current = {
        messages: messages.slice(), // Create a copy
        attachmentIds: [...attachmentIds],
      };
    },
    [],
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
    // Enhanced stop function with partial save capability
    stop: stopWithSave,
    // Expose partial save state
    isSavingPartial,
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
      console.log("[useChat] sendMessage called:", {
        contentLength: content.trim().length,
        attachmentIdsCount: attachmentIds?.length || 0,
        enableWebBrowsing: options?.enableWebBrowsing,
        experimentalAttachmentsCount:
          options?.experimental_attachments?.length || 0,
        timestamp: new Date().toISOString(),
      });

      if (
        !content.trim() &&
        (!attachmentIds || attachmentIds.length === 0) &&
        !options?.experimental_attachments?.length
      ) {
        return;
      }

      try {
        // Track this message for potential partial save
        const currentMessages = [...chat.messages];
        const newUserMessage: Message = {
          id: `user-${Date.now()}`,
          role: "user",
          content: content.trim(),
          ...(options?.experimental_attachments && {
            experimental_attachments: options.experimental_attachments,
          }),
        };
        trackMessageForPartialSave(
          [...currentMessages, newUserMessage],
          attachmentIds,
        );

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

          console.log("[useChat] Appending message with attachments:", {
            appendOptionsBody: appendOptions.body,
            timestamp: new Date().toISOString(),
          });

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

          console.log("[useChat] Appending regular message:", {
            appendOptionsBody: appendOptions.body,
            timestamp: new Date().toISOString(),
          });

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
