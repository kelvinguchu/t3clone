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

// Optimized retry logic that leverages Convex conversation history
export async function handleRetryMessage({
  threadId,
  status,
  hookMessages,
  selectedModel,
  data,
  isAnonymous,
  anonSessionId,
  removeLastAssistantMessage,
  setMessages,
  reload,
  sendMessage,
}: RetryMessageHandlerParams): Promise<void> {
  if (!threadId) {
    return;
  }

  try {
    console.log("[RetryHandler] Starting optimized retry operation", {
      threadId,
      selectedModel,
      hookMessagesCount: hookMessages.length,
    });

    // Step 1: Remove the last assistant message from the database
    await removeLastAssistantMessage({
      threadId: threadId as Id<"threads">,
      ...(isAnonymous && anonSessionId ? { sessionId: anonSessionId } : {}),
    });

    // Step 2: Find the last assistant message to remove from UI
    let lastAssistantIndex = -1;
    for (let i = hookMessages.length - 1; i >= 0; i--) {
      if (hookMessages[i].role === "assistant") {
        lastAssistantIndex = i;
        break;
      }
    }

    if (lastAssistantIndex === -1) {
      console.warn("[RetryHandler] No assistant message found to remove");
      return;
    }

    // Step 3: Remove the assistant message from the UI state
    setMessages((currentMessages) => {
      return currentMessages.slice(0, lastAssistantIndex);
    });

    // Step 4: Small delay to ensure UI updates
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step 5: Use the AI SDK's reload() function
    // The key optimization is that our server-side code now detects retry operations
    // and loads conversation history from Convex instead of using the client-sent messages
    console.log(
      "[RetryHandler] Using AI SDK reload() with server-side conversation loading optimization",
    );

    await reload();

    console.log("[RetryHandler] Optimized retry completed successfully");
  } catch (error) {
    console.error("[RetryHandler] Retry failed:", error);
    throw error;
  }
}
