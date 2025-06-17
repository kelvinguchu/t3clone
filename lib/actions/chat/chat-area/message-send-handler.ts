import type { ModelId } from "@/lib/ai-providers";
import type { Id } from "@/convex/_generated/dataModel";
import { generateThreadTitle, shouldUpdateTitle } from "@/lib/title-generator";

export interface AttachmentPreview {
  id: string;
  name: string;
  contentType: string;
  url: string;
  size: number;
}

export interface MessageSendOptions {
  enableWebBrowsing?: boolean;
}

export interface ThreadMeta {
  title: string;
  [key: string]: unknown;
}

export interface MessageSendHandlerParams {
  sendMessage: (
    content: string,
    attachmentIds?: string[],
    options?: {
      experimental_attachments?: Array<{
        name: string;
        contentType: string;
        url: string;
      }>;
      enableWebBrowsing?: boolean;
    },
  ) => void;
  selectedModel: ModelId;
  initialThreadId: string | null;
  isAnonymous: boolean;
  anonSessionId: string | null;
  threadId: string | null;
  threadMeta: ThreadMeta | null;
  updateThreadMutation: (params: {
    threadId: Id<"threads">;
    title: string;
    sessionId?: string;
  }) => Promise<unknown>;
  setPendingBrowsing: (pending: boolean) => void;
  setPendingThinking: (pending: boolean) => void;
  setPrefillMessage: (message: string | null) => void;
}

// Handle message sending with attachments and web browsing
export async function handleMessageSend(
  message: string,
  attachmentIds: string[] | undefined,
  attachmentPreviews: AttachmentPreview[] | undefined,
  options: MessageSendOptions | undefined,
  params: MessageSendHandlerParams,
): Promise<void> {
  const {
    sendMessage,
    selectedModel,
    initialThreadId,
    isAnonymous,
    anonSessionId,
    threadId,
    threadMeta,
    updateThreadMutation,
    setPendingBrowsing,
    setPendingThinking,
    setPrefillMessage,
  } = params;

  if (!message.trim() && (!attachmentIds || attachmentIds.length === 0)) {
    return;
  }

  try {
    // Convert attachment previews to experimental_attachments format for AI SDK
    const experimentalAttachments = attachmentPreviews?.map((preview) => ({
      name: preview.name,
      contentType: preview.contentType,
      url: preview.url,
    }));

    // Use AI SDK's sendMessage for optimistic updates and proper streaming
    sendMessage(message, attachmentIds, {
      experimental_attachments: experimentalAttachments,
      enableWebBrowsing: options?.enableWebBrowsing,
    });

    // Store browsing flag for UI indicator
    setPendingBrowsing(!!options?.enableWebBrowsing);

    // Auto-detect thinking models and set thinking flag
    const reasoningModels = ["deepseek-r1-distill-llama-70b", "qwen/qwen3-32b"];

    if (reasoningModels.includes(selectedModel)) {
      setPendingThinking(true);
    }

    // Cache user message in background (non-blocking)
    if (initialThreadId) {
      // Don't await - cache in background to avoid blocking UI
      fetch("/api/cache/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: initialThreadId,
          message: {
            role: "user",
            content: message,
            timestamp: Date.now(),
            model: selectedModel,
            messageId: `user-${Date.now()}`,
          },
          sessionId: isAnonymous ? anonSessionId : undefined,
        }),
      }).catch((error) => {
        console.error(
          "[MessageSendHandler] HANDLE_SEND - Error caching user message (non-blocking):",
          error,
        );
      });
    }

    // Auto-update thread title if it's still "New Chat" (background operation)
    if (threadId && threadMeta && shouldUpdateTitle(threadMeta.title)) {
      // Don't await - update title in background
      generateThreadTitle(message)
        .then((newTitle) => {
          return updateThreadMutation({
            threadId: threadId as Id<"threads">,
            title: newTitle,
            ...(isAnonymous && anonSessionId
              ? { sessionId: anonSessionId }
              : {}),
          });
        })
        .then(() => {
          // Thread title updated successfully
        })
        .catch((error) => {
          console.error(
            "[MessageSendHandler] Failed to auto-update thread title (non-blocking):",
            error,
          );
        });
    }
  } catch (error) {
    console.error(
      "[MessageSendHandler] HANDLE_SEND - Error sending message:",
      error,
    );
    // Error sending message
    // Message will be restored via the error state
    // ensure ChatInput keeps its current contents if error occurs – let the
    // component manage it locally.
  }

  // reset any pre-filled prompt after successful send
  setPrefillMessage(null);
}
