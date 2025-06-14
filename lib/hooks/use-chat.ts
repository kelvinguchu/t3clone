"use client";

import { useChat as useVercelAIChat, type Message } from "@ai-sdk/react";
import { useAnonymousSession } from "./use-anonymous-session";
import { type ModelId } from "@/lib/ai-providers";
import { useState } from "react";

interface UseChatProps {
  modelId: ModelId;
  initialThreadId?: string | null;
  onError?: (error: Error) => void;
  initialMessages?: Message[];
}

export function useChat({
  modelId,
  initialThreadId = null,
  onError,
  initialMessages,
}: UseChatProps) {
  const hookId = `hook-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  console.log(`[${hookId}] USECHAT - Hook initialized with:`, {
    modelId,
    initialThreadId,
    hasOnError: !!onError,
    initialMessagesCount: initialMessages?.length,
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

  const chat = useVercelAIChat({
    id: threadId ?? undefined,
    api: "/api/chat",
    streamProtocol: "text", // Treat server reply as plain text; no streaming expected
    initialMessages,
    body: requestBody,
    headers: requestHeaders,
    // Enable multi-step tool execution
    maxSteps: 5,
    onError: (error) => {
      console.error(`[${hookId}] USECHAT - onError called:`, error);
      onError?.(error);
    },
    onResponse: (response) => {
      console.log(`[${hookId}] USECHAT - onResponse called:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      // Handle rate limiting headers
      const newThreadId = response.headers.get("X-Thread-Id");

      if (newThreadId) {
        console.log(
          `[${hookId}] USECHAT - Setting new thread ID:`,
          newThreadId,
        );
        setThreadId(newThreadId);
      }
    },
    onFinish: () => {
      console.log(`[${hookId}] USECHAT - onFinish called`);

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
  });

  return {
    ...chat,
    modelId,
    isAnonymous,
    threadId,
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
      console.log(`[${hookId}] USECHAT - sendMessage called [${messageId}]:`, {
        contentLength: content.trim().length,
        contentPreview: content.substring(0, 50) + "...",
        attachmentIdsCount: attachmentIds?.length ?? 0,
        attachmentIds,
        hasExperimentalAttachments: !!options?.experimental_attachments?.length,
        experimentalAttachments: options?.experimental_attachments?.map(
          (a) => ({
            name: a.name,
            contentType: a.contentType,
            urlPreview: a.url.substring(0, 50) + "...",
          }),
        ),
        enableWebBrowsing: options?.enableWebBrowsing,
        optionsObject: options,
        currentThreadId: threadId,
        currentAttachmentIds,
        timestamp: new Date().toISOString(),
      });

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
          `[${hookId}] USECHAT - appendOptions for experimental_attachments [${messageId}]:`,
          appendOptions,
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
          `[${hookId}] USECHAT - appendOptions for regular message [${messageId}]:`,
          appendOptions,
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
        `[${hookId}] USECHAT - Message sending initiated successfully [${messageId}]`,
      );
    },
    // Check if currently loading/streaming using status
    isLoading: chat.status === "submitted" || chat.status === "streaming",
  };
}
