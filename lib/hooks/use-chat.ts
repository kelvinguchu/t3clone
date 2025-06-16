"use client";

import { useChat as useVercelAIChat, type Message } from "@ai-sdk/react";
import type { JSONValue } from "ai";
import { useAnonymousSession } from "./use-anonymous-session";
import { type ModelId } from "@/lib/ai-providers";
import { useState, useCallback, useRef } from "react";

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
  console.log(`[${hookId}] USECHAT - Hook initialized with:`, {
    modelId,
    initialThreadId,
    hasOnError: !!onError,
    initialMessagesCount: initialMessages?.length,
    experimental_throttle,
    sendExtraMessageFields,
    timestamp: new Date().toISOString(),
  });

  const { sessionData, isAnonymous, refreshSession } = useAnonymousSession();

  // Persist thread ID across messages so server doesn't create a new thread each time
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [currentAttachmentIds, setCurrentAttachmentIds] = useState<string[]>(
    [],
  );

  console.log(`[${hookId}] USECHAT - Current state:`, {
    threadId,
    currentAttachmentIds,
    sessionData: sessionData
      ? {
          sessionId: sessionData.sessionId,
          remainingMessages: sessionData.remainingMessages,
        }
      : null,
    isAnonymous,
  });

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

  console.log(`[${hookId}] USECHAT - Request configuration:`, {
    body: requestBody,
    headers: requestHeaders,
  });

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
        console.log(
          `[${hookId}] PREPARE_REQUEST_BODY - Building request body:`,
          {
            messagesCount: messages.length,
            id,
            modelId,
            threadId,
            currentAttachmentIds,
            requestBodyKeys: requestBody ? Object.keys(requestBody) : [],
            requestBodyContent: requestBody,
            timestamp: new Date().toISOString(),
          },
        );

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

        console.log(`[${hookId}] PREPARE_REQUEST_BODY - Final request body:`, {
          requestBodyKeys: Object.keys(finalRequestBody),
          enableWebBrowsing: finalRequestBody.enableWebBrowsing,
          hasEnableWebBrowsing: "enableWebBrowsing" in finalRequestBody,
          requestBodyPreview: {
            messagesCount: Array.isArray(finalRequestBody.messages)
              ? finalRequestBody.messages.length
              : 0,
            modelId: finalRequestBody.modelId,
            threadId: finalRequestBody.threadId,
            enableWebBrowsing: finalRequestBody.enableWebBrowsing,
          },
        });

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
      console.log(
        `[${hookId}] USECHAT - onResponse called (IMMEDIATE FEEDBACK):`,
        {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          timestamp: new Date().toISOString(),
        },
      );

      // Handle rate limiting headers
      const newThreadId = response.headers.get("X-Thread-Id");

      if (newThreadId) {
        console.log(
          `[${hookId}] USECHAT - Setting new thread ID:`,
          newThreadId,
        );
        setThreadId(newThreadId);
      }

      // Immediate UI feedback - response received, streaming will start
      console.log(
        `[${hookId}] USECHAT - Response received, streaming starting...`,
      );
    },
    [hookId],
  );

  const handleFinish = useCallback(
    (
      message: Message,
      {
        usage,
        finishReason,
      }: {
        usage?: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        };
        finishReason?: string;
      },
    ) => {
      console.log(`[${hookId}] USECHAT - onFinish called:`, {
        messageId: message.id,
        messageLength: message.content.length,
        usage,
        finishReason,
        timestamp: new Date().toISOString(),
      });

      // Clear attachment IDs after message is sent
      setCurrentAttachmentIds([]);

      // Refresh session data for anonymous users to get updated message count
      if (isAnonymous && sessionData) {
        console.log(
          `[${hookId}] USECHAT - Refreshing session for anonymous user`,
        );
        refreshSession();
      }
    },
    [hookId, isAnonymous, sessionData, refreshSession],
  );

  const handleError = useCallback(
    (error: Error) => {
      console.error(`[${hookId}] USECHAT - onError called:`, {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      onError?.(error);
    },
    [hookId, onError],
  );

  const chat = useVercelAIChat({
    id: threadId ?? undefined,
    api: "/api/chat",
    // Use text protocol for Groq models to fix streaming hangs
    streamProtocol: modelId === "llama3-70b-8192" ? "text" : "data",
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
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      console.log(
        `[${hookId}] WEB_BROWSING_SENDMESSAGE - sendMessage called with web browsing [${messageId}]:`,
        {
          contentLength: content.trim().length,
          contentPreview: content.substring(0, 50) + "...",
          enableWebBrowsing: options?.enableWebBrowsing,
          optionsObject: options,
          hasExperimentalAttachments:
            !!options?.experimental_attachments?.length,
          currentStatus: chat.status,
          timestamp: new Date().toISOString(),
        },
      );

      if (
        !content.trim() &&
        (!attachmentIds || attachmentIds.length === 0) &&
        !options?.experimental_attachments?.length
      ) {
        console.log(
          `[${hookId}] USECHAT - sendMessage blocked [${messageId}]: no content, no attachments, and no experimental attachments`,
        );
        return;
      }

      // Immediate UI feedback - message is being sent
      console.log(
        `[${hookId}] USECHAT - Message sending initiated [${messageId}] - Status will change to 'submitted'`,
      );

      if (options?.experimental_attachments?.length) {
        console.log(
          `[${hookId}] USECHAT - Using chat.append with experimental_attachments [${messageId}]`,
        );

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

        console.log(
          `[${hookId}] WEB_BROWSING_APPEND_EXP - appendOptions for experimental_attachments [${messageId}]:`,
          {
            enableWebBrowsing: appendOptions.body.enableWebBrowsing,
            bodyKeys: Object.keys(appendOptions.body),
            fullBody: appendOptions.body,
          },
        );

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
        console.log(
          `[${hookId}] USECHAT - Using chat.append for regular message [${messageId}]`,
        );

        // Build request body for regular message
        const appendOptions: {
          body: Record<string, unknown>;
        } = {
          body: {},
        };

        if (options?.enableWebBrowsing) {
          appendOptions.body.enableWebBrowsing = true;
        }

        console.log(
          `[${hookId}] WEB_BROWSING_APPEND_REG - appendOptions for regular message [${messageId}]:`,
          {
            enableWebBrowsing: appendOptions.body.enableWebBrowsing,
            bodyKeys: Object.keys(appendOptions.body),
            fullBody: appendOptions.body,
          },
        );

        chat.append(
          {
            role: "user",
            content: content.trim(),
          },
          appendOptions,
        );
      }

      console.log(
        `[${hookId}] USECHAT - Message sending initiated successfully [${messageId}] - UI should show immediate feedback`,
      );
    },
  };
}
