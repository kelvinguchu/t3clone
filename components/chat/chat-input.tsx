"use client";

import { useUser } from "@clerk/nextjs";
import { FilePreview } from "./chat-input/file-preview";
import { useFilePreview } from "@/lib/contexts/file-preview-context";
import {
  useInputStateManager,
  usePlaceholderAnimation,
} from "@/lib/actions/chat/chat-input/input-state-manager";
import { useDraftPersistence } from "@/lib/actions/chat/chat-input/draft-persistence-manager";
import { useFileUploadHandler } from "@/lib/actions/chat/chat-input/file-upload-handler";
import { useSessionRateManager } from "@/lib/actions/chat/chat-input/session-rate-manager";
import { useInputActionsHandler } from "@/lib/actions/chat/chat-input/input-actions-handler";
import { RateLimitWarnings } from "./chat-input/rate-limit-warnings";
import { InputControls } from "./chat-input/input-controls";
import { TextInputArea } from "./chat-input/text-input-area";
import { getModelInfo } from "@/lib/ai-providers";

// Types

export interface AttachmentPreview {
  id: string;
  name: string;
  contentType: string;
  url: string;
  size: number;
}

export interface SessionData {
  isAnonymous: boolean;
  canSendMessage: boolean;
  remainingMessages: number;
  messageCount: number;
}

export interface ChatInputProps {
  onSend: (
    message: string,
    attachmentIds?: string[],
    attachmentPreviews?: AttachmentPreview[],
    options?: { enableWebBrowsing?: boolean },
  ) => void;
  onStop?: () => void;
  status?: string;
  presetMessage?: string | null;
  onHeightChange?: (height: number) => void;
  sessionData?: SessionData;
  isLoaded: boolean;
  isSavingPartial?: boolean;
  threadAttachments?: AttachmentPreview[]; // Thread-level attachments for model filtering
}

export function ChatInput({
  onSend,
  onStop,
  status = "ready",
  presetMessage,
  onHeightChange,
  sessionData,
  isLoaded,
  isSavingPartial = false,
  threadAttachments = [],
}: Readonly<ChatInputProps>) {
  const { isLoaded: userIsLoaded } = useUser();

  // Input state management
  const inputState = useInputStateManager({
    presetMessage,
    onHeightChange,
  });

  // Get current model capabilities
  const currentModelInfo = getModelInfo(inputState.selectedModel);

  // File upload functionality
  const fileUpload = useFileUploadHandler({
    attachmentIds: inputState.attachmentIds,
    setAttachmentIds: inputState.setAttachmentIds,
    modelCapabilities: {
      vision: currentModelInfo.capabilities.vision,
      multimodal: currentModelInfo.capabilities.multimodal,
      fileAttachments: currentModelInfo.capabilities.fileAttachments,
    },
    onError: (error) => {
      console.error("File upload error:", error);
      // Error is handled by the FileUpload hook's internal state
      // and displayed via the FilePreview component
    },
  });

  // Session and rate limiting
  const sessionRate = useSessionRateManager({
    sessionData,
    isLoaded,
    status,
    isUploading: fileUpload.isUploading,
    message: inputState.message,
    attachmentCount: inputState.attachmentIds.length,
  });

  // File preview context
  const { removeFilePreview, addFilePreview } = useFilePreview();

  // Draft persistence
  const { clearDraftMessage, clearDraftAttachments } = useDraftPersistence({
    currentThreadKey: inputState.currentThreadKey,
    message: inputState.message,
    setMessage: inputState.setMessage,
    attachmentPreviews: fileUpload.attachmentPreviews,
    setAttachmentIds: inputState.setAttachmentIds,
    presetMessage,
    autoResize: inputState.autoResize,
    addFilePreview,
  });

  // Input actions handling
  const inputActions = useInputActionsHandler({
    message: inputState.message,
    setMessage: inputState.setMessage,
    attachmentIds: inputState.attachmentIds,
    setAttachmentIds: inputState.setAttachmentIds,
    attachmentPreviews: fileUpload.attachmentPreviews,
    isStreaming: sessionRate.isStreaming,
    isAnonymous: sessionRate.isAnonymous,
    canSendMessage: sessionRate.canSendMessage,
    isUploading: fileUpload.isUploading,
    enableWebBrowsing: inputState.enableWebBrowsing,
    onSend,
    onStop,
    removeFilePreview,
    currentThreadKey: inputState.currentThreadKey,
    clearDraftMessage,
    clearDraftAttachments,
  });

  // Placeholder animation
  usePlaceholderAnimation(
    inputState.placeholderTexts,
    inputState.message,
    inputState.attachmentIds.length,
    inputState.setPlaceholderIndex,
  );

  return (
    <>
      {/* Rate limiting warnings */}
      <RateLimitWarnings
        isMounted={inputState.isMounted}
        isAnonymous={sessionRate.isAnonymous}
        isLoaded={userIsLoaded}
        warningLevel={sessionRate.warningLevel}
        remainingMessages={sessionRate.remainingMessages}
        isRateLimited={sessionRate.isRateLimited}
        canSendMessage={sessionRate.canSendMessage}
      />

      {/* File Attachments Preview */}
      <FilePreview
        files={fileUpload.attachmentPreviews}
        onRemove={fileUpload.removeAttachment}
        error={fileUpload.error}
        onClearError={fileUpload.clearError}
      />

      {/* Clean Chat Input Area */}
      <div
        ref={inputState.inputContainerRef}
        className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto bg-purple-50/30 dark:bg-dark-bg/50 z-50"
      >
        <div className="mx-auto w-full sm:w-[95%] md:w-[90%] lg:w-[80%] p-2 sm:p-2 md:p-3 border-t-2 border-l-2 border-r-2 border-purple-300 dark:border-dark-purple-accent rounded-t-xl bg-purple-100/90 dark:bg-dark-bg-secondary/90">
          {/* Hidden file input - accept attribute based on model capabilities */}
          <input
            ref={fileUpload.fileInputRef}
            type="file"
            multiple
            accept={
              currentModelInfo.capabilities.fileAttachments
                ? currentModelInfo.capabilities.vision ||
                  currentModelInfo.capabilities.multimodal
                  ? "image/*,application/pdf,text/*"
                  : "application/pdf,text/*"
                : ""
            }
            onChange={fileUpload.handleFileSelect}
            className="hidden"
          />

          {/* Text Input Area */}
          <TextInputArea
            ref={inputState.textareaRef}
            message={inputState.message}
            setMessage={inputState.setMessage}
            placeholderIndex={inputState.placeholderIndex}
            placeholderTexts={inputState.placeholderTexts}
            isRateLimited={sessionRate.isRateLimited}
            isStreaming={sessionRate.isStreaming}
            isUploading={fileUpload.isUploading}
            isDisabled={sessionRate.isDisabled}
            attachmentPreviews={fileUpload.attachmentPreviews}
            handleSendOrStop={inputActions.handleSendOrStop}
          />

          {/* Input Controls */}
          <InputControls
            selectedModel={inputState.selectedModel}
            setSelectedModel={inputState.setSelectedModel}
            _hasHydrated={inputState._hasHydrated}
            canSend={sessionRate.canSend}
            canStop={sessionRate.canStop}
            isDisabled={sessionRate.isDisabled}
            isSavingPartial={isSavingPartial}
            enableWebBrowsing={inputState.enableWebBrowsing}
            setEnableWebBrowsing={inputState.setEnableWebBrowsing}
            attachmentPreviews={fileUpload.attachmentPreviews}
            threadAttachments={threadAttachments}
            triggerFileSelect={fileUpload.triggerFileSelect}
            handleSendOrStop={inputActions.handleSendOrStop}
            getButtonTitle={inputActions.getButtonTitle}
          />
        </div>
      </div>
    </>
  );
}
