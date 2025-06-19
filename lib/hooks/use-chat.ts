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
  experimental_throttle = 50,
  sendExtraMessageFields = false,
  experimental_prepareRequestBody,
}: UseChatProps) {
  // Generate stable hook ID for tracking
  const hookIdRef = useRef<string | null>(null);
  if (!hookIdRef.current) {
    hookIdRef.current = `hook-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
  }

  const { sessionData, isAnonymous, refreshSession } = useAnonymousSession();

  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [currentAttachmentIds, setCurrentAttachmentIds] = useState<string[]>(
    [],
  );

  // Track partial save state and request context
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

  // Prepare request body with model, thread, and attachment context
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
        const finalRequestBody: Record<string, unknown> = {
          messages,
          id,
          modelId,
          ...(threadId && { threadId }),
          ...(currentAttachmentIds.length > 0 && {
            attachmentIds: currentAttachmentIds,
          }),
          ...(requestBody as Record<string, unknown>),
        };

        return finalRequestBody;
      }),
    [
      experimental_prepareRequestBody,
      modelId,
      threadId,
      currentAttachmentIds,
    ],
  );

  // Extract thread ID from response headers
  const handleResponse = useCallback(
    (response: Response) => {
      const newThreadId = response.headers.get("X-Thread-Id");
      if (newThreadId) {
        setThreadId(newThreadId);
      }
    },
    [],
  );

  // Handle message completion and cleanup
  const handleFinish = useCallback(async () => {
    // Clear attachment IDs after message completion
    setCurrentAttachmentIds([]);

    // Refresh session for anonymous users to update message count
    if (isAnonymous && sessionData) {
      refreshSession();
    }
  }, [isAnonymous, sessionData, refreshSession]);

  const handleError = useCallback(
    (error: Error) => {
      handleChatError(error);
      onError?.(error);
    },
    [onError],
  );

  const chat = useVercelAIChat({
    id: threadId ?? undefined,
    api: "/api/chat",
    streamProtocol: "data",
    initialMessages,
    body: requestBody,
    headers: requestHeaders,
    maxSteps: 10,
    experimental_throttle,
    sendExtraMessageFields,
    experimental_prepareRequestBody: optimizedPrepareRequestBody,
    onResponse: handleResponse,
    onFinish: handleFinish,
    onError: handleError,
  });

  // Error handler with retry functionality
  const handleErrorWithRetry = useCallback(
    (error: Error) => {
      const parsedError = handleChatError(error, () => {
        chat.reload?.();
      });

      if (shouldAutoRetry(parsedError)) {
        setTimeout(() => {
          chat.reload?.();
        }, 2000);
      }
    },
    [chat],
  );

  // Save partial message content to database
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

        if (result.threadId && !threadId) {
          setThreadId(result.threadId);
        }
      } catch {
        // Silently handle partial save failures
      } finally {
        setIsSavingPartial(false);
      }
    },
    [sessionData, threadId, modelId],
  );

  // Stop streaming and save partial content
  const stopWithSave = useCallback(async () => {
    const currentMessages = chat.messages;
    const lastMessage = currentMessages[currentMessages.length - 1];

    if (
      lastMessage &&
      lastMessage.role === "assistant" &&
      lastMessage.content
    ) {
      const messagesToSave =
        lastRequestDataRef.current?.messages || currentMessages.slice(0, -1);
      const attachmentIds = lastRequestDataRef.current?.attachmentIds || [];

      await savePartialContent(
        lastMessage.content,
        messagesToSave,
        attachmentIds,
      );
    }

    chat.stop?.();

    // Clear tracking references
    lastMessageRef.current = null;
    lastRequestDataRef.current = null;
  }, [chat, savePartialContent]);

  const trackMessageForPartialSave = useCallback(
    (messages: Message[], attachmentIds: string[] = []) => {
      lastRequestDataRef.current = {
        messages: messages.slice(),
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
    experimental_resume: chat.experimental_resume,
    isLoading: chat.status === "submitted" || chat.status === "streaming",
    status: chat.status,
    stop: stopWithSave,
    isSavingPartial,
    // Send message with attachments and web browsing support
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
        // Track message context for potential partial save
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
          const appendOptions: {
            body: Record<string, unknown>;
          } = {
            body: {},
          };

          if (attachmentIds && attachmentIds.length > 0) {
            appendOptions.body.attachmentIds = attachmentIds;
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

          chat.setInput("");
        } else {
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
        if (error instanceof Error) {
          handleErrorWithRetry(error);
        }
      }
    },
  };
}
