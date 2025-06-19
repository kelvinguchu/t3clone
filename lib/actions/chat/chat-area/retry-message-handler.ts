import type { Message } from "@ai-sdk/react";
import type { ModelId } from "@/lib/ai-providers";
import type { Id } from "@/convex/_generated/dataModel";

export interface RetryMessageHandlerParams {
  threadId: string | null;
  status: string;
  hookMessages: Message[];
  selectedModel: ModelId;
  data: unknown;
  isAnonymous: boolean;
  anonSessionId: string | null;
  removeLastAssistantMessage: (params: {
    threadId: Id<"threads">;
    sessionId?: string;
  }) => Promise<unknown>;
  setMessages: (updater: (messages: Message[]) => Message[]) => void;
  reload: () => Promise<string | null | undefined>;
  sendMessage: (content: string) => Promise<void>;
}

// Retry failed message by removing last assistant response and reloading
export async function handleRetryMessage({
  threadId,
  hookMessages,
  selectedModel,
  isAnonymous,
  anonSessionId,
  removeLastAssistantMessage,
  setMessages,
  reload,
}: RetryMessageHandlerParams): Promise<void> {
  if (!threadId) {
    return;
  }

  try {
    // Remove failed assistant message from database
    await removeLastAssistantMessage({
      threadId: threadId as Id<"threads">,
      ...(isAnonymous && anonSessionId ? { sessionId: anonSessionId } : {}),
    });

    // Find last assistant message in UI state
    let lastAssistantIndex = -1;
    for (let i = hookMessages.length - 1; i >= 0; i--) {
      if (hookMessages[i].role === "assistant") {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex === -1) {
      return;
    }

    // Remove assistant message from UI
    setMessages((currentMessages) => {
      return currentMessages.slice(0, lastAssistantIndex);
    });

    // Brief delay for UI update
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Reload conversation from server (uses Convex history for retry detection)
    await reload();
  } catch (error) {
    throw error;
  }
}
