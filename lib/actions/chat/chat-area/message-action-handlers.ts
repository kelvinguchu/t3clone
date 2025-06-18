import { useState, useCallback } from "react";

export interface MessageActionHandlersParams {
  reload?: () => Promise<string | null | undefined>;
}

export interface MessageActionHandlersReturn {
  copiedIndex: number | null;
  handleCopy: (content: string, index: number) => Promise<void>;
  handleRetry: () => Promise<void>;
}

/**
 * Custom hook for handling message actions (copy and retry)
 * Extracted from chat-messages.tsx
 */
export function useMessageActionHandlers({
  reload,
}: MessageActionHandlersParams): MessageActionHandlersReturn {
  // Track which assistant message was recently copied
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = useCallback(async (content: string, index: number) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        // Fallback for mobile/older browsers
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
      // Could show a toast notification here
    }
  }, []);

  const handleRetry = useCallback(async () => {
    if (!reload) return;

    try {
      await reload();
    } catch (error) {
      console.error("Failed to retry message:", error);
      if (error instanceof Error) {
        const { handleChatError } = await import("@/lib/utils/error-handler");
        handleChatError(error, handleRetry);
      }
    }
  }, [reload]);

  return {
    copiedIndex,
    handleCopy,
    handleRetry,
  };
}
