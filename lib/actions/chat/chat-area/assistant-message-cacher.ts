import { useEffect } from "react";
import type { Message } from "@ai-sdk/react";
import type { ModelId } from "@/lib/ai-providers";
import type { Id } from "@/convex/_generated/dataModel";
import {
  generateThreadTitleClient,
  shouldUpdateTitle,
} from "@/lib/title-generator";

export interface AssistantMessageCacherParams {
  isLoading: boolean;
  effectiveMessages: Message[];
  threadId: string | null;
  selectedModel: ModelId;
  isAnonymous: boolean;
  anonSessionId: string | null;
  threadMeta: { title?: string } | null;
  updateThreadMutation: (params: {
    threadId: Id<"threads">;
    title: string;
    sessionId?: string;
  }) => Promise<unknown>;
}

// Cache assistant messages when streaming completes and auto-update thread titles
export function useAssistantMessageCaching({
  isLoading,
  effectiveMessages,
  threadId,
  selectedModel,
  isAnonymous,
  anonSessionId,
  threadMeta,
  updateThreadMutation,
}: AssistantMessageCacherParams): void {
  useEffect(() => {
    const cacheAssistantMessages = async () => {
      if (!isLoading && threadId && effectiveMessages.length > 0) {
        // Find the latest assistant message that isn't cached yet
        const lastMessage = effectiveMessages[effectiveMessages.length - 1];

        if (lastMessage?.role === "assistant" && lastMessage.content.trim()) {
          try {
            await fetch("/api/cache/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                threadId,
                message: {
                  role: "assistant",
                  content: lastMessage.content,
                  timestamp: Date.now(),
                  model: selectedModel,
                  messageId:
                    (lastMessage as { _id?: string })._id ||
                    `assistant-${Date.now()}`,
                },
                sessionId: isAnonymous ? anonSessionId : undefined,
              }),
            });
            // Cached assistant message via API

            // Auto-update thread title from AI response if still "New Chat"
            if (
              threadMeta &&
              threadMeta.title &&
              shouldUpdateTitle(threadMeta.title)
            ) {
              try {
                const newTitle = await generateThreadTitleClient(
                  lastMessage.content,
                );
                await updateThreadMutation({
                  threadId: threadId as Id<"threads">,
                  title: newTitle,
                  ...(isAnonymous && anonSessionId
                    ? { sessionId: anonSessionId }
                    : {}),
                });
                // Auto-updated thread title from AI response
              } catch {
                // Failed to auto-update thread title from AI response
              }
            }
          } catch {
            // Failed to cache assistant message
          }
        }

        // Attachments are now handled via experimental_attachments in AI SDK
      }
    };

    // Only cache when streaming is complete
    if (!isLoading) {
      cacheAssistantMessages();
    }
  }, [
    isLoading,
    effectiveMessages,
    threadId,
    selectedModel,
    isAnonymous,
    anonSessionId,
    threadMeta,
    updateThreadMutation,
  ]);
}
