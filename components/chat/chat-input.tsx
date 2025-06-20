"use client";

import { useEffect } from "react";
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
import { InputControls } from "./chat-input/input-controls";
import { TextInputArea } from "./chat-input/text-input-area";
import { getModelInfo } from "@/lib/ai-providers";
import { useModelStore } from "@/lib/stores/model-store";

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

// Virtual keyboard handling for mobile devices
function setupVirtualKeyboardHandling() {
  // Modern VirtualKeyboard API for supported browsers
  if ("virtualKeyboard" in navigator) {
    try {
      (
        navigator as unknown as {
          virtualKeyboard: { overlaysContent: boolean };
        }
      ).virtualKeyboard.overlaysContent = true;
    } catch {
      // Silently fail if API is not fully supported
    }
  }

  // Visual Viewport API fallback for iOS Safari and other browsers
  if (window.visualViewport) {
    let pendingUpdate = false;

    function handleViewportChange() {
      if (pendingUpdate) return;
      pendingUpdate = true;

      requestAnimationFrame(() => {
        pendingUpdate = false;

        const keyboardHeight = Math.max(
          0,
          window.innerHeight -
            window.visualViewport!.height -
            window.visualViewport!.offsetTop,
        );
        document.documentElement.style.setProperty(
          "--keyboard-height",
          `${keyboardHeight}px`,
        );

        window.dispatchEvent(
          new CustomEvent("virtualkeyboard", {
            detail: { keyboardHeight, isOpen: keyboardHeight > 0 },
          }),
        );
      });
    }

    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener(
        "resize",
        handleViewportChange,
      );
      window.visualViewport?.removeEventListener(
        "scroll",
        handleViewportChange,
      );
    };
  }

  return () => {};
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

  // Initialize virtual keyboard handling for mobile
  useEffect(() => {
    const cleanup = setupVirtualKeyboardHandling();
    return cleanup;
  }, []);

  // Input state management
  const inputState = useInputStateManager({
    presetMessage,
    onHeightChange,
  });

  // Model store and capabilities
  const { isReady: isModelStoreReady } = useModelStore();
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
    onError: () => {
      // Error handled by FileUpload hook and displayed via FilePreview
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

  // Wait for model store to be ready before rendering
  if (!isModelStoreReady) {
    return (
      <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto bg-purple-50/30 dark:bg-dark-bg/50 z-50">
        <div className="mx-auto w-full sm:w-[95%] md:w-[90%] lg:w-[80%] p-2 sm:p-2 md:p-3 border-t-2 border-l-2 border-r-2 border-purple-300 dark:border-dark-purple-accent rounded-t-xl bg-purple-100/90 dark:bg-dark-bg-secondary/90">
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
            <span className="ml-2 text-sm text-purple-600 dark:text-purple-400">
              Loading...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* File Attachments Preview */}
      <FilePreview
        files={fileUpload.attachmentPreviews}
        onRemove={fileUpload.removeAttachment}
        error={fileUpload.error}
        onClearError={fileUpload.clearError}
      />

      {/* Chat Input Area with Virtual Keyboard Support */}
      <div
        ref={inputState.inputContainerRef}
        className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto bg-purple-50/30 dark:bg-dark-bg/50 z-50"
        style={{
          bottom: "max(0px, env(keyboard-inset-height, 0px))",
          transform: "translateY(calc(-1 * var(--keyboard-height, 0px)))",
        }}
      >
        <div className="mx-auto w-full sm:w-[95%] md:w-[90%] lg:w-[80%] p-2 sm:p-2 md:p-3 border-t-2 border-l-2 border-r-2 border-purple-300 dark:border-dark-purple-accent rounded-t-xl bg-purple-100/90 dark:bg-dark-bg-secondary/90">
          {/* Hidden file input with model-based accept filter */}
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
