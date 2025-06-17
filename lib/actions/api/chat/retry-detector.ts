import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { Message } from "ai";

export interface RetryDetectionResult {
  isRetryOperation: boolean;
  shouldSaveUserMessage: boolean;
  error?: string;
}

// Detect if this is a retry operation and whether to skip saving duplicate user message
export async function detectRetryOperation(
  messages: Message[],
  finalThreadId: string | null,
  fetchOptions?: { token: string },
  requestId?: string,
): Promise<RetryDetectionResult> {
  const logPrefix = requestId ? `[${requestId}]` : "[detectRetryOperation]";

  // Check if this is a retry operation by looking for existing messages
  const isRetryOperation = messages.length > 1 && finalThreadId;
  let shouldSaveUserMessage = true;

  if (!isRetryOperation) {
    return {
      isRetryOperation: false,
      shouldSaveUserMessage: true,
    };
  }

  if (!finalThreadId) {
    return {
      isRetryOperation: false,
      shouldSaveUserMessage: true,
    };
  }

  try {
    // For retry operations, check if the user message already exists
    const existingMessages = await fetchQuery(
      api.messages.getThreadMessages,
      { threadId: finalThreadId as Id<"threads"> },
      fetchOptions,
    );

    const lastUserMessage = messages[messages.length - 1];
    const messageExists = existingMessages.some(
      (msg) => msg.role === "user" && msg.content === lastUserMessage?.content,
    );

    if (messageExists) {
      shouldSaveUserMessage = false;
    }

    return {
      isRetryOperation: true,
      shouldSaveUserMessage,
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
      isRetryOperation: true,
      shouldSaveUserMessage: true,
      error: errorMessage,
    };
  }
}
