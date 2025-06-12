"use client";

import { useChat as useVercelAIChat } from "@ai-sdk/react";
import { useAnonymousSession } from "./use-anonymous-session";
import { type ModelId } from "@/lib/ai-providers";
import { useState } from "react";

interface UseChatProps {
  modelId: ModelId;
  initialThreadId?: string | null;
  onError?: (error: Error) => void;
}

export function useChat({
  modelId,
  initialThreadId = null,
  onError,
}: UseChatProps) {
  const { sessionData, isAnonymous, refreshSession } = useAnonymousSession();

  // Persist thread ID across messages so server doesn't create a new thread each time
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);

  const chat = useVercelAIChat({
    api: "/api/chat",
    streamProtocol: "data", // Use data stream protocol for better streaming
    body: {
      modelId,
      // Include threadId so the backend appends to existing conversation
      ...(threadId && { threadId }),
    },
    headers: {
      ...(sessionData && { "X-Session-ID": sessionData.sessionId }),
      ...(threadId && { "X-Thread-Id": threadId }),
    },
    onError: (error) => {
      console.error("🚨 Chat Hook: Error occurred:", error);
      console.error(
        "🚨 Chat Hook: Error name:",
        error instanceof Error ? error.name : "Unknown",
      );
      console.error(
        "🚨 Chat Hook: Error message:",
        error instanceof Error ? error.message : String(error),
      );
      onError?.(error);
    },
    onResponse: (response) => {
      console.log("✅ Chat Hook: Response received, status:", response.status);
      console.log(
        "✅ Chat Hook: Response headers:",
        Array.from(response.headers.entries()),
      );

      // Handle rate limiting headers
      const remainingMessages = response.headers.get("X-RateLimit-Remaining");
      const newThreadId = response.headers.get("X-Thread-Id");

      if (remainingMessages) {
        console.log(
          `📊 Anonymous user has ${remainingMessages} messages remaining`,
        );
      }

      if (newThreadId) {
        console.log(`🧵 Thread ID: ${newThreadId}`);
        setThreadId(newThreadId);
      }
    },
    onFinish: (message) => {
      console.log("🏁 Chat Hook: Message finished:", {
        role: message.role,
        content:
          message.content?.slice(0, 100) +
          (message.content && message.content.length > 100 ? "..." : ""),
        toolInvocations: message.toolInvocations?.length || 0,
      });

      // Refresh session data for anonymous users to get updated message count
      if (isAnonymous && sessionData) {
        console.log(
          "🔄 Chat Hook: Refreshing anonymous session data after message",
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
    // Add convenient method for sending messages
    sendMessage: (content: string) => {
      if (!content.trim()) return;

      chat.append({
        role: "user",
        content: content.trim(),
      });
    },
    // Check if currently loading/streaming using status
    isLoading: chat.status === "submitted" || chat.status === "streaming",
  };
}
