import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { Message } from "ai";

export interface MessageSaveResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Save user message to database and link any attachments
export async function saveUserMessage(
  shouldSaveUserMessage: boolean,
  messages: Message[],
  finalThreadId: string,
  userId: string | null,
  finalSessionId: string | null,
  attachmentIds?: string[],
  fetchOptions?: { token: string },
): Promise<MessageSaveResult> {
  // Skip saving if message already exists (retry scenario)
  if (!shouldSaveUserMessage) {
    return { success: true };
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    return {
      success: false,
      error: "No user message to save",
    };
  }

  try {
    let messageId: string | undefined;

    if (userId) {
      messageId = await fetchMutation(
        api.messages.addMessage,
        {
          threadId: finalThreadId as Id<"threads">,
          content: lastMessage.content,
          role: "user",
        },
        fetchOptions,
      );
    } else {
      if (!finalSessionId) {
        return {
          success: false,
          error: "Session ID required for anonymous message",
        };
      }

      messageId = await fetchMutation(api.messages.createAnonymousMessage, {
        threadId: finalThreadId as Id<"threads">,
        sessionId: finalSessionId,
        content: lastMessage.content,
        role: "user",
      });
    }

    // Link any file attachments to the saved message
    if (attachmentIds && attachmentIds.length > 0 && messageId) {
      for (const attachmentId of attachmentIds) {
        try {
          await fetchMutation(
            api.attachments.linkAttachmentToThread,
            {
              attachmentId: attachmentId as Id<"attachments">,
              threadId: finalThreadId as Id<"threads">,
              messageId: messageId as Id<"messages">,
            },
            fetchOptions,
          );
        } catch {
          // Silently handle attachment linking failures
        }
      }
    }

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return {
      success: false,
      error: errorMessage,
    };
  }
}
