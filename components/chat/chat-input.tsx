"use client";

import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";
import { Paperclip, AlertTriangle, Clock, Globe, Send } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";
import { useFilePreview } from "@/lib/contexts/file-preview-context";
import {
  getAvailableModels,
  getModelInfo,
  type ModelId,
} from "@/lib/ai-providers";
import { FilePreview } from "./file-preview";
import { useModelStore } from "@/lib/stores/model-store";

interface ChatInputProps {
  /**
   * Optional preset message coming from the parent (e.g. quick-prompt). When
   * this value changes we overwrite the local message state once but we do
   * NOT propagate every keystroke back up – this keeps the parent from
   * re-rendering on every input change.
   */
  presetMessage?: string | null;
  onSend: (
    message: string,
    attachmentIds?: string[],
    attachmentPreviews?: Array<{
      id: string;
      name: string;
      contentType: string;
      url: string;
      size: number;
    }>,
    options?: {
      enableWebBrowsing?: boolean;
    },
  ) => void;
  isLoading?: boolean;
  // Session data passed from parent to avoid duplicate hook calls
  sessionData?: {
    isAnonymous: boolean;
    canSendMessage: boolean;
    remainingMessages: number;
    messageCount: number;
  };
}

const ChatInput = memo(function ChatInput({
  presetMessage = "",
  onSend,
  isLoading = false,
  sessionData,
}: Readonly<ChatInputProps>) {
  const { isLoaded } = useUser();

  // Use Zustand store for model selection
  const { selectedModel, setSelectedModel } = useModelStore();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  // Store attachment IDs instead of full attachment objects for better integration with Convex
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Web browsing toggle state - persist across sessions
  const [enableWebBrowsing, setEnableWebBrowsing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Initialize web browsing state after component mounts (hydration-safe)
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("enableWebBrowsing");
      const initialState = saved === "true";
      setEnableWebBrowsing(initialState);
    }
  }, []);

  // Persist web browsing state to localStorage
  useEffect(() => {
    if (isMounted && typeof window !== "undefined") {
      localStorage.setItem("enableWebBrowsing", enableWebBrowsing.toString());
    }
  }, [enableWebBrowsing, isMounted]);

  // Use centralized file preview context
  const { addFilePreview, removeFilePreview, fileData } = useFilePreview();

  // Get current attachment previews from context - memoized to prevent re-renders
  const attachmentPreviews = useMemo(() => {
    return Array.from(fileData.values()).filter((file) =>
      attachmentIds.includes(file.id),
    );
  }, [fileData, attachmentIds]);

  // Live anonymous session stats - passed from parent to avoid duplicate hook calls
  const { isAnonymous, canSendMessage, remainingMessages, messageCount } =
    useMemo(() => {
      const stats = {
        isAnonymous: sessionData?.isAnonymous ?? false,
        canSendMessage: sessionData?.canSendMessage ?? true,
        remainingMessages: sessionData?.remainingMessages ?? 10,
        messageCount: sessionData?.messageCount ?? 0,
      };

      return stats;
    }, [
      sessionData?.isAnonymous,
      sessionData?.canSendMessage,
      sessionData?.remainingMessages,
      sessionData?.messageCount,
    ]);

  // File upload hook
  const { startUpload, isUploading } = useUploadThing("chatAttachment");

  // Get available models and current model info - memoized to prevent re-renders
  const availableModels = useMemo(() => getAvailableModels(), []);
  const currentModelInfo = useMemo(
    () => getModelInfo(selectedModel),
    [selectedModel],
  );

  const placeholderTexts = useMemo(
    () => [
      "Ask me anything...",
      "Start a conversation...",
      "What's on your mind?",
      "Let's explore ideas together...",
      "Type your message here...",
      "Ready to chat?",
      "Press Enter to send, Shift+Enter for new line...",
    ],
    [],
  );

  // Local uncontrolled message state – isolated from parent re-renders
  const [message, setMessage] = useState<string>(presetMessage || "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cycling placeholder animation - only when input is empty
  useEffect(() => {
    // Only animate when input is completely empty and no attachments
    if (message.trim() || attachmentPreviews.length > 0) {
      return; // No interval when user has content
    }

    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [placeholderTexts.length, message, attachmentPreviews.length]);

  // Auto-resize function
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max height of 120px (about 5 lines)
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // Keep local state in sync when presetMessage changes
  useEffect(() => {
    if (presetMessage) {
      setMessage(presetMessage);
      // Auto-resize after setting preset message
      setTimeout(autoResize, 0);
    }
  }, [presetMessage, autoResize]);

  // Auto-resize when message changes
  useEffect(() => {
    autoResize();
  }, [message, autoResize]);

  const handleSend = useCallback(() => {
    if (
      (!message.trim() && attachmentIds.length === 0) ||
      isLoading ||
      isUploading
    ) {
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
    setMessage("");
  }, [
    message,
    attachmentIds,
    attachmentPreviews,
    isLoading,
    isUploading,
    isAnonymous,
    canSendMessage,
    onSend,
    removeFilePreview,
    enableWebBrowsing,
  ]);

  // Hidden file input
  const originalAccept = "image/*,application/pdf,text/*";
  // Utility to temporarily change accept and open picker
  const triggerFileSelect = useCallback((accept: string) => {
    const input = fileInputRef.current;
    if (!input) return;
    const previous = input.accept;
    input.accept = accept;
    input.click();
    // Restore immediately – the opened chooser keeps the filter
    input.accept = previous;
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      if (files.length === 0) return;

      // Filter for supported file types (images and PDFs)
      const supportedFiles = files.filter((file) => {
        return (
          file.type.startsWith("image/") ||
          file.type === "application/pdf" ||
          file.type.startsWith("text/")
        );
      });

      if (supportedFiles.length !== files.length) {
        alert("Only images, PDFs, and text files are supported.");
      }

      if (supportedFiles.length > 0) {
        // Immediately show preview with loading state
        const immediatePreview = supportedFiles.map((file) => ({
          id: `temp-${Date.now()}-${Math.random()}`,
          name: file.name,
          contentType: file.type,
          url: URL.createObjectURL(file), // Create temporary URL for immediate preview
          size: file.size,
          isUploading: true, // Flag to show loading state
        }));

        // Add files to context and track their IDs
        immediatePreview.forEach((preview) => {
          addFilePreview(preview);
          setAttachmentIds((prev) => [...prev, preview.id]);
        });
        // Start upload and handle the promise
        startUpload(supportedFiles)
          .then((uploadedFiles) => {
            if (!uploadedFiles) return;

            const files = uploadedFiles as Array<{
              name: string;
              size: number;
              key: string;
              url: string;
              type?: string;
              // UploadThing v{>=9} places custom return values inside `serverData`
              // Older versions may return the fields at top level. We support both.
              serverData?: { attachmentId?: string | null };
              attachmentId?: string | null;
            }>;

            // Store attachment IDs
            const newAttachmentIds: string[] = [];

            // Update temporary previews with final data
            files.forEach((file, index) => {
              const tempId = immediatePreview[index]?.id;
              if (tempId) {
                // Remove temporary preview
                removeFilePreview(tempId);
                setAttachmentIds((prev) => prev.filter((id) => id !== tempId));
              }

              const resolvedAttachmentId =
                file.serverData?.attachmentId || // Preferred (UploadThing server response)
                file.attachmentId || // Backwards-compatibility fallback
                null;

              // Ignore file if the server did not return a Convex attachmentId
              if (!resolvedAttachmentId) {
                console.warn(
                  "[ChatInput] UPLOAD_COMPLETE - No attachmentId returned for file, skipping linkage",
                  { name: file.name, key: file.key },
                );
                return;
              }

              // Add final file data
              const finalFileData = {
                id: resolvedAttachmentId,
                name: file.name,
                contentType: (file.type ?? file.name).includes(".pdf")
                  ? "application/pdf"
                  : (file.type ?? "image/jpeg"),
                url: file.url,
                size: file.size,
              };

              addFilePreview(finalFileData);
              newAttachmentIds.push(resolvedAttachmentId);
            });
            setAttachmentIds((prev) => [...prev, ...newAttachmentIds]);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          })
          .catch((error) => {
            console.error("[ChatInput] UPLOAD_ERROR - Upload failed:", error);
            // Clean up temporary previews on error
            immediatePreview.forEach((preview) => {
              removeFilePreview(preview.id);
              setAttachmentIds((prev) =>
                prev.filter((id) => id !== preview.id),
              );
            });
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          });
      }
    },
    [startUpload, addFilePreview, removeFilePreview],
  );

  const removeAttachment = useCallback(
    (index: number) => {
      // Get the file ID at the specified index
      const fileId = attachmentIds[index];
      if (fileId) {
        // Remove from context (this handles blob URL cleanup)
        removeFilePreview(fileId);
        // Remove from attachment IDs
        setAttachmentIds((prev) => prev.filter((_, i) => i !== index));
      }
    },
    [attachmentIds, removeFilePreview],
  );

  // Get warning level - memoized to prevent re-renders
  const warningLevel = useMemo(() => {
    if (!isAnonymous || !isLoaded) return null;

    const used = messageCount;
    const total = 10; // Total allowed messages
    const percentage = (used / total) * 100;

    if (percentage >= 90) return { color: "red", level: "critical" };
    if (percentage >= 70) return { color: "orange", level: "warning" };
    if (percentage >= 50) return { color: "yellow", level: "caution" };
    return null;
  }, [isAnonymous, isLoaded, messageCount]);

  const isRateLimited = isAnonymous && !canSendMessage;
  const isDisabled = isLoading || isRateLimited;
  const canSend =
    (message.trim() || attachmentPreviews.length > 0) &&
    !isDisabled &&
    !isUploading;

  return (
    <>
      {/* Rate Limiting Warning for Anonymous Users */}
      {isAnonymous && isLoaded && warningLevel && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`mx-auto w-[90%] px-4 py-2 border-x-2 ${
            warningLevel.color === "red"
              ? "bg-red-50/90 dark:bg-red-950/30 border-red-300 dark:border-red-700"
              : warningLevel.color === "orange"
                ? "bg-orange-50/90 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700"
                : "bg-yellow-50/90 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle
              className={`h-4 w-4 ${
                warningLevel.color === "red"
                  ? "text-red-600 dark:text-red-400"
                  : warningLevel.color === "orange"
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-yellow-600 dark:text-yellow-400"
              }`}
            />
            <span
              className={`font-medium ${
                warningLevel.color === "red"
                  ? "text-red-800 dark:text-red-200"
                  : warningLevel.color === "orange"
                    ? "text-orange-800 dark:text-orange-200"
                    : "text-yellow-800 dark:text-yellow-200"
              }`}
            >
              {warningLevel.level === "critical"
                ? `Only ${remainingMessages} messages left! Sign up for unlimited access.`
                : warningLevel.level === "warning"
                  ? `${remainingMessages} messages remaining. Consider signing up.`
                  : `${remainingMessages} of 10 messages remaining.`}
            </span>
          </div>
        </motion.div>
      )}

      {/* Rate Limit Exceeded Warning */}
      {isRateLimited && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-[90%] px-4 py-3 border-x-2 bg-red-50/90 dark:bg-red-950/30 border-red-300 dark:border-red-700"
        >
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="font-medium text-red-800 dark:text-red-200">
              Message limit reached! Sign up to continue chatting or wait 24
              hours for reset.
            </span>
          </div>
        </motion.div>
      )}

      {/* File Attachments Preview */}
      <FilePreview files={attachmentPreviews} onRemove={removeAttachment} />

      {/* Clean Chat Input Area */}
      <div className="relative bg-purple-50/30 dark:bg-purple-950/30">
        <div className="mx-auto w-[80%] p-4 border-t-2 border-l-2 border-r-2 border-purple-300 dark:border-purple-700 rounded-t-xl bg-purple-100/90 dark:bg-purple-900/90">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={originalAccept}
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Main Input Container */}
          <div className="relative">
            <div
              className={`p-2 rounded-xl bg-white dark:bg-purple-800 border-2 border-purple-300 dark:border-purple-600 shadow-lg shadow-purple-500/10 focus-within:border-purple-500 dark:focus-within:border-purple-400 focus-within:shadow-purple-500/20 transition-all duration-300 ${
                !message.trim() && attachmentPreviews.length === 0
                  ? "hover:shadow-purple-500/30"
                  : ""
              } ${
                isDisabled
                  ? "opacity-50 cursor-not-allowed border-red-300 dark:border-red-600"
                  : ""
              }`}
            >
              {/* Textarea Container */}
              <div className="relative min-h-[24px]">
                {/* Animated Placeholder */}
                {!message.trim() && attachmentPreviews.length === 0 && (
                  <div className="absolute top-0 left-0 pointer-events-none">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={placeholderIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{
                          duration: 0.5,
                          ease: "easeInOut",
                        }}
                        className="text-sm text-purple-700 dark:text-purple-300 font-medium"
                      >
                        {isRateLimited
                          ? "Message limit reached. Sign up to continue..."
                          : isLoading
                            ? "Generating..."
                            : isUploading
                              ? "Uploading files..."
                              : placeholderTexts[placeholderIndex]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                )}

                <Textarea
                  ref={textareaRef}
                  placeholder=""
                  className="border-none shadow-none bg-transparent focus-visible:ring-0 text-sm placeholder:text-transparent resize-none min-h-[24px] font-medium transition-all duration-200 w-full text-purple-900 dark:text-purple-100 p-0 overflow-y-auto"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                    // Allow Shift+Enter for new lines (default behavior)
                  }}
                  disabled={isDisabled}
                  rows={1}
                  style={{
                    height: "auto",
                    minHeight: "24px",
                    maxHeight: "120px",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Row: Model Selector and Action Buttons */}
          <div className="flex items-center justify-between mt-3 px-1">
            {/* Left side: Model selector and action buttons */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedModel}
                onValueChange={(newModel) => {
                  setSelectedModel(newModel as ModelId);
                }}
                disabled={isLoading}
              >
                <SelectTrigger className="group w-auto min-w-48 border-2 border-purple-300 dark:border-purple-600 bg-white dark:bg-purple-800 backdrop-blur-md text-xs text-purple-700 dark:text-purple-200 hover:bg-purple-50 dark:hover:bg-purple-700 hover:border-purple-400 dark:hover:border-purple-500 rounded-xl h-8 shadow-lg shadow-purple-500/10 transition-all duration-300 hover:shadow-purple-500/20 hover:scale-[1.02]">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <img
                        src={currentModelInfo.icon}
                        alt={currentModelInfo.name}
                        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <span className="font-semibold tracking-wide">
                      {currentModelInfo.name}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="border-2 border-purple-300 dark:border-purple-600 bg-white dark:bg-purple-800 backdrop-blur-xl shadow-2xl shadow-purple-500/25 rounded-xl p-1">
                  {availableModels.map((modelId) => {
                    const modelInfo = getModelInfo(modelId);
                    return (
                      <SelectItem
                        key={modelId}
                        value={modelId}
                        className={`rounded-lg hover:bg-purple-50 dark:hover:bg-purple-700 transition-all duration-200 hover:scale-[1.02] focus:bg-gradient-to-r ${
                          modelInfo.theme === "blue"
                            ? "focus:from-blue-500/10 focus:to-blue-600/10"
                            : modelInfo.theme === "green"
                              ? "focus:from-green-500/10 focus:to-green-600/10"
                              : "focus:from-orange-500/10 focus:to-orange-600/10"
                        }`}
                      >
                        <div className="flex items-center gap-3 py-1">
                          <div className="relative">
                            <img
                              src={modelInfo.icon}
                              alt={modelInfo.name}
                              className="h-4 w-4"
                            />
                            <div
                              className={`absolute -inset-1 rounded-full blur-sm opacity-60 ${
                                modelInfo.theme === "blue"
                                  ? "bg-blue-400/20"
                                  : modelInfo.theme === "green"
                                    ? "bg-green-400/20"
                                    : "bg-orange-400/20"
                              }`}
                            ></div>
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">
                              {modelInfo.name}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {modelInfo.description}
                            </p>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Action Buttons */}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-700 rounded-lg"
                title="Attach files (images, PDFs, text)"
                disabled={isDisabled}
                onClick={() =>
                  triggerFileSelect("image/*,application/pdf,text/*")
                }
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className={`h-7 w-7 rounded-lg transition-all duration-200 ${
                  enableWebBrowsing
                    ? "text-emerald-600 hover:text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/40"
                    : "text-gray-600 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                title={
                  enableWebBrowsing
                    ? "Web browsing enabled - AI will browse the web for information"
                    : "Enable web browsing - AI will search and browse websites when needed"
                }
                disabled={isDisabled}
                onClick={() => {
                  const newState = !enableWebBrowsing;
                  setEnableWebBrowsing(newState);
                }}
              >
                <Globe className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Right side: Send Button */}
            <Button
              size="icon"
              variant={canSend ? "default" : "ghost"}
              className={`h-8 w-8 shrink-0 transition-all duration-200 ${
                canSend
                  ? "bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl hover:scale-105"
                  : "text-purple-400 dark:text-purple-500 cursor-not-allowed"
              }`}
              onClick={handleSend}
              disabled={!canSend}
              title={canSend ? "Send message" : "Type a message to send"}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
});

export { ChatInput };
