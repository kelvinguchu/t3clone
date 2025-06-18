import { useCallback } from "react";

export interface AttachmentPreview {
  id: string;
  name: string;
  contentType: string;
  url: string;
  size: number;
}

export interface InputActionsHandlerParams {
  // Message and attachment state
  message: string;
  setMessage: (message: string) => void;
  attachmentIds: string[];
  setAttachmentIds: React.Dispatch<React.SetStateAction<string[]>>;
  attachmentPreviews: AttachmentPreview[];

  // Session and rate limiting
  isStreaming: boolean;
  isAnonymous: boolean;
  canSendMessage: boolean;
  isUploading: boolean;

  // Web browsing
  enableWebBrowsing: boolean;

  // Parent callbacks
  onSend: (
    message: string,
    attachmentIds?: string[],
    attachmentPreviews?: AttachmentPreview[],
    options?: { enableWebBrowsing?: boolean },
  ) => void;
  onStop?: () => void;

  // File preview context
  removeFilePreview: (id: string) => void;

  // Draft management
  currentThreadKey: string;
  clearDraftMessage: (key: string) => void;
  clearDraftAttachments: (key: string) => void;
}

export interface InputActionsHandlerReturn {
  handleSendOrStop: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  getButtonTitle: (
    canSend: boolean,
    canStop: boolean,
    isSavingPartial: boolean,
  ) => string;
}

/**
 * Custom hook that manages all input action handling including send/stop, keyboard events,
 * and button interactions extracted from the original chat-input.tsx
 */
export function useInputActionsHandler({
  message,
  setMessage,
  attachmentIds,
  setAttachmentIds,
  attachmentPreviews,
  isStreaming,
  isAnonymous,
  canSendMessage,
  isUploading,
  enableWebBrowsing,
  onSend,
  onStop,
  removeFilePreview,
  currentThreadKey,
  clearDraftMessage,
  clearDraftAttachments,
}: InputActionsHandlerParams): InputActionsHandlerReturn {
  // Handle send or stop action - extracted from original chat-input.tsx lines 393-440
  const handleSendOrStop = useCallback(() => {
    if (isStreaming && onStop) {
      // Stop the current generation (this will save partial content)
      onStop();
    } else {
      // Send new message
      if ((!message.trim() && attachmentIds.length === 0) || isUploading) {
        return;
      }

      // Check rate limits for anonymous users
      if (isAnonymous && !canSendMessage) {
        return;
      }

      onSend(
        message,
        attachmentIds.length > 0 ? attachmentIds : undefined,
        attachmentPreviews.length > 0 ? attachmentPreviews : undefined,
        { enableWebBrowsing },
      );

      // Clear attachments from context
      attachmentIds.forEach((id) => removeFilePreview(id));
      setAttachmentIds([]);

      // Clear message and drafts
      setMessage("");
      clearDraftMessage(currentThreadKey);
      clearDraftAttachments(currentThreadKey);
    }
  }, [
    isStreaming,
    onStop,
    message,
    attachmentIds,
    attachmentPreviews,
    isUploading,
    isAnonymous,
    canSendMessage,
    onSend,
    removeFilePreview,
    enableWebBrowsing,
    currentThreadKey,
    clearDraftMessage,
    clearDraftAttachments,
    setMessage,
    setAttachmentIds,
  ]);

  // Handle keyboard events - extracted from original chat-input.tsx lines 747-753
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendOrStop();
      }
      // Allow Shift+Enter for new lines (default behavior)
    },
    [handleSendOrStop],
  );

  // Enhanced button title with partial save feedback - extracted from original chat-input.tsx lines 443-448
  const getButtonTitle = useCallback(
    (canSend: boolean, canStop: boolean, isSavingPartial: boolean) => {
      if (isSavingPartial) return "Saving partial response...";
      if (canStop) return "Stop generation and save partial response";
      if (canSend) return "Send message";
      return "Type a message to send";
    },
    [],
  );

  return {
    handleSendOrStop,
    handleKeyDown,
    getButtonTitle,
  };
}

/**
 * Utility function to handle web browsing toggle
 */
export function handleWebBrowsingToggle(
  currentState: boolean,
  setEnableWebBrowsing: (enabled: boolean) => void,
): void {
  const newState = !currentState;
  setEnableWebBrowsing(newState);
}

/**
 * Utility function to check if send action is valid
 */
export function canSendMessage(
  message: string,
  attachmentCount: number,
  isUploading: boolean,
  isAnonymous: boolean,
  canSendMessageFromSession: boolean,
): boolean {
  // Must have content
  if (!message.trim() && attachmentCount === 0) return false;

  // Must not be uploading
  if (isUploading) return false;

  // Check rate limits for anonymous users
  if (isAnonymous && !canSendMessageFromSession) return false;

  return true;
}

/**
 * Utility function to determine button variant based on state
 */
export function getButtonVariant(
  canSend: boolean,
  canStop: boolean,
): "default" | "ghost" {
  return canSend || canStop ? "default" : "ghost";
}

/**
 * Utility function to get button icon based on state
 */
export function getButtonIcon(
  canStop: boolean,
  isSavingPartial: boolean,
): "send" | "stop" | "loading" {
  if (isSavingPartial) return "loading";
  if (canStop) return "stop";
  return "send";
}

/**
 * Utility function to get web browsing button title
 */
export function getWebBrowsingTitle(enabled: boolean): string {
  return enabled
    ? "Web browsing enabled - AI will browse the web for information"
    : "Enable web browsing - AI will search and browse websites when needed";
}
