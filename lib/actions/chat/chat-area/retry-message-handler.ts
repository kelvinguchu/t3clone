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

// Handle retry logic for different model types (reasoning vs standard)
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
    // Check if this is a reasoning model that uses data protocol
    const isReasoningModel =
      selectedModel === "deepseek-r1-distill-llama-70b" ||
      selectedModel === "qwen/qwen3-32b";

    // First remove the last assistant message from the database
    await removeLastAssistantMessage({
      threadId: threadId as Id<"threads">,
      ...(isAnonymous && anonSessionId ? { sessionId: anonSessionId } : {}),
    });

    // Find the last user message to retry and the assistant message to remove
    let lastUserMessage: Message | null = null;
    let lastAssistantIndex = -1;
    let lastUserIndex = -1;

    // Find the last assistant message and the user message before it
    for (let i = hookMessages.length - 1; i >= 0; i--) {
      if (hookMessages[i].role === "assistant" && lastAssistantIndex === -1) {
        lastAssistantIndex = i;
      } else if (
        hookMessages[i].role === "user" &&
        lastAssistantIndex !== -1 &&
        lastUserMessage === null
      ) {
        lastUserMessage = hookMessages[i];
        lastUserIndex = i;
        break;
      }
    }

    if (!lastUserMessage) {
      return;
    }

    if (isReasoningModel) {
      // For reasoning models with data protocol, the state is too complex to clean manually
      // Instead, we'll use reload() but first clean up the database state
      // This lets the AI SDK handle the complex data protocol state internally

      // Use the AI SDK's reload function which properly handles data protocol state
      await reload();
    } else {
      // For standard models (text protocol), use the simpler approach
      setMessages((currentMessages) => {
        // Remove everything from the user message onwards (user + assistant)
        const newMessages = currentMessages.slice(0, lastUserIndex);
        return newMessages;
      });

      // Standard delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send the message again
      await sendMessage(lastUserMessage.content);
    }
  } catch (error) {
    console.error("Failed to retry message:", error);
    // If everything fails, try the basic reload as fallback
    await reload();
  }
}
