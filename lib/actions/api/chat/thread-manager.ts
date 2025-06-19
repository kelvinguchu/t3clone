import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Message } from "ai";
import type { ModelId } from "@/lib/ai-providers";

export interface ThreadCreationResult {
  threadId: string | null;
  success: boolean;
  error?: string;
}

// Create thread if needed for both authenticated and anonymous users
export async function createThreadIfNeeded(
  finalThreadId: string | null,
  messages: Message[],
  modelId: ModelId,
  userId: string | null,
  finalSessionId: string | null,
  ipHash: string | null,
  fetchOptions?: { token: string },
  requestId?: string,
): Promise<ThreadCreationResult> {
  const logPrefix = requestId ? `[${requestId}]` : "[createThreadIfNeeded]";

  // If thread already exists, return it
  if (finalThreadId) {
    return {
      threadId: finalThreadId,
      success: true,
    };
  }

  try {
    // Generate smart title from the last message
    const lastMessage = messages[messages.length - 1];
    const smartTitle =
      typeof lastMessage?.content === "string"
        ? lastMessage.content.slice(0, 50) +
          (lastMessage.content.length > 50 ? "..." : "")
        : "New Chat";

    let newThreadId: string;

    if (userId) {
      // Create thread for authenticated user
      newThreadId = await fetchMutation(
        api.threads.createThread,
        {
          title: smartTitle,
          model: modelId,
        },
        fetchOptions,
      );
    } else {
      // Create thread for anonymous user
      if (!finalSessionId) {
        throw new Error("Session ID required for anonymous thread creation");
      }

      newThreadId = await fetchMutation(api.threads.createAnonymousThread, {
        sessionId: finalSessionId,
        title: smartTitle,
        model: modelId,
        ipHash: ipHash ?? undefined,
      });
    }

    return {
      threadId: newThreadId,
      success: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `${logPrefix} CHAT_API - Background thread creation failed:`,
      error,
    );

    return {
      threadId: null,
      success: false,
      error: errorMessage,
    };
  }
}
