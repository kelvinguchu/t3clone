import { conversationCache } from "@/lib/conversation-context";
import { activeSessions, stopSession } from "@/lib/tools/browser-tool";
import type { Message } from "ai";
import type { ModelId } from "@/lib/ai-providers";

export interface CachingResult {
  success: boolean;
  error?: string;
}

export interface BrowserCleanupResult {
  success: boolean;
  sessionsCleanedUp: number;
  error?: string;
}

// Cache conversation context for performance
export async function cacheConversationContext(
  finalThreadId: string | null,
  messages: Message[],
  modelId: ModelId,
  requestId?: string,
): Promise<CachingResult> {
  const logPrefix = requestId ? `[${requestId}]` : "[cacheConversationContext]";

  if (!finalThreadId) {
    return { success: true }; // No thread to cache
  }

  try {
    const conversationMessage = {
      role: "user" as const,
      content: messages[messages.length - 1]?.content || "",
      timestamp: Date.now(),
      model: modelId,
      messageId: `user-${Date.now()}`,
    };

    await conversationCache.appendMessage(finalThreadId, conversationMessage);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`${logPrefix} CHAT_API - Background caching failed:`, error);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// Cleanup browser sessions
export async function cleanupBrowserSessions(
  requestId?: string,
): Promise<BrowserCleanupResult> {
  const logPrefix = requestId ? `[${requestId}]` : "[cleanupBrowserSessions]";

  try {
    let cleanedUpCount = 0;

    if (activeSessions.size > 0) {
      for (const id of Array.from(activeSessions)) {
        await stopSession(id);
        activeSessions.delete(id);
        cleanedUpCount++;
      }
    }

    return {
      success: true,
      sessionsCleanedUp: cleanedUpCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.warn(
      `${logPrefix} CHAT_API - Background session cleanup failed:`,
      error,
    );

    return {
      success: false,
      sessionsCleanedUp: 0,
      error: errorMessage,
    };
  }
}
