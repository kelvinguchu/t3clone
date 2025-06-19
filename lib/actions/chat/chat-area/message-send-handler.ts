import type { ModelId } from "@/lib/ai-providers";
import type { Id } from "@/convex/_generated/dataModel";
import {
  generateThreadTitleClient,
  shouldUpdateTitle,
} from "@/lib/title-generator";

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

// Process message sending with attachments, web browsing, and background operations
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

  // Skip empty messages without attachments
  if (!message.trim() && (!attachmentIds || attachmentIds.length === 0)) {
    return;
  }

  try {
    // Convert attachment previews for AI SDK compatibility
    const experimentalAttachments = attachmentPreviews?.map((preview) => ({
      name: preview.name,
      contentType: preview.contentType,
      url: preview.url,
    }));

    // Send message with AI SDK for optimistic updates and streaming
    sendMessage(message, attachmentIds, {
      experimental_attachments: experimentalAttachments,
      enableWebBrowsing: options?.enableWebBrowsing,
    });

    // Set UI state for web browsing indicator
    setPendingBrowsing(!!options?.enableWebBrowsing);

    // Enable thinking state for reasoning models
    const reasoningModels = ["deepseek-r1-distill-llama-70b", "qwen/qwen3-32b"];
    if (reasoningModels.includes(selectedModel)) {
      setPendingThinking(true);
    }

    // Cache user message in background for performance
    if (initialThreadId) {
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
      }).catch(() => {
        // Silently handle caching failures (non-critical)
      });
    }

    // Auto-generate thread title in background
    if (threadId && threadMeta && shouldUpdateTitle(threadMeta.title)) {
      generateThreadTitleClient(message)
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
          // Title updated successfully
        })
        .catch(() => {
          // Silently handle title update failures (non-critical)
        });
    }
  } catch {
    // Error sending message - let ChatInput handle error state
  }

  // Clear any pre-filled prompt after send attempt
  setPrefillMessage(null);
}
