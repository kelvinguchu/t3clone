import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { Message } from "ai";

export interface RetryDetectionResult {
  isRetryOperation: boolean;
  shouldSaveUserMessage: boolean;
  error?: string;
}

// Simplified retry detection - main optimization is now in the route handler
export async function detectRetryOperation(
  messages: Message[],
  finalThreadId: string | null,
  fetchOptions?: { token: string },
  requestId?: string,
): Promise<RetryDetectionResult> {
  const logPrefix = requestId ? `[${requestId}]` : "[detectRetryOperation]";

  // If no thread ID, this is a new conversation
  if (!finalThreadId) {
    return {
      isRetryOperation: false,
      shouldSaveUserMessage: true,
    };
  }

  // Find the last user message in the messages array
  let lastUserMessage: Message | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserMessage = messages[i];
      break;
    }
  }

  // If no user message found, something is wrong
  if (!lastUserMessage) {
    return {
      isRetryOperation: false,
      shouldSaveUserMessage: false,
    };
  }

  try {
    // Get existing messages from the database
    const existingMessages = await fetchQuery(
      api.messages.getThreadMessages,
      { threadId: finalThreadId as Id<"threads"> },
      fetchOptions,
    );

    // FIXED: Check if this is the LAST user message that's being retried
    // Only consider it a retry if the most recent user message matches exactly
    const lastUserMessageInDB = existingMessages
      .filter((msg) => msg.role === "user")
      .pop(); // Get the most recent user message

    const isRetry =
      lastUserMessageInDB &&
      lastUserMessageInDB.content === lastUserMessage!.content;

    if (isRetry) {
      console.log(
        `${logPrefix} CHAT_API - Last user message matches, this is a retry operation`,
        {
          messageContent: lastUserMessage.content.substring(0, 100) + "...",
          existingMessagesCount: existingMessages.length,
          lastUserMessageInDB:
            lastUserMessageInDB.content.substring(0, 100) + "...",
        },
      );
    } else {
      console.log(
        `${logPrefix} CHAT_API - New user message, will save to database`,
        {
          newMessageContent: lastUserMessage.content.substring(0, 100) + "...",
          lastDBUserMessage:
            lastUserMessageInDB?.content.substring(0, 100) + "..." || "none",
          existingMessagesCount: existingMessages.length,
        },
      );
    }

    return {
      isRetryOperation: isRetry || false,
      shouldSaveUserMessage: !isRetry,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.warn(
      `${logPrefix} CHAT_API - Could not check for existing messages, proceeding with save:`,
      error,
    );

    // If we can't check for existing messages, proceed with saving (fail safe)
    return {
      isRetryOperation: false,
      shouldSaveUserMessage: true,
      error: errorMessage,
    };
  }
}
