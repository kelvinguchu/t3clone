"use client";

import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";
import {
  Paperclip,
  AlertTriangle,
  Clock,
  Globe,
  Send,
  Square,
  Eye,
  Brain,
  Wrench,
  Image,
  Layers,
  Zap,
  FileText,
} from "lucide-react";
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
  // Session data passed from parent to avoid duplicate hook calls
  sessionData?: {
    isAnonymous: boolean;
    canSendMessage: boolean;
    remainingMessages: number;
    messageCount: number;
  };
  // Callback to report input height changes to parent
  onHeightChange?: (height: number) => void;
  // Stop function from useChat hook
  onStop?: () => void;
  // Status from useChat hook for determining button state
  status?: "ready" | "submitted" | "streaming" | "error";
  // Partial save state for visual feedback
  isSavingPartial?: boolean;
}

const ChatInput = memo(function ChatInput({
  presetMessage = "",
  onSend,
  sessionData,
  onHeightChange,
  onStop,
  status = "ready",
  isSavingPartial,
}: Readonly<ChatInputProps>) {
  const { isLoaded } = useUser();
  const pathname = usePathname();

  // Use Zustand store for model selection
  const { selectedModel, setSelectedModel, _hasHydrated } = useModelStore();
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
    ],
    [],
  );

  // Get current thread ID from pathname
  const currentThreadKey = useMemo(() => {
    if (pathname === "/chat") {
      return "new-chat"; // Special key for the main chat page
    }
    if (pathname?.startsWith("/chat/")) {
      const threadId = pathname.split("/")[2];
      return `thread-${threadId}`;
    }
    return "new-chat"; // Fallback
  }, [pathname]);

  // localStorage utilities for draft messages
  const getDraftMessage = useCallback((key: string): string => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(`chat-draft-${key}`) || "";
    } catch {
      return "";
    }
  }, []);

  const saveDraftMessage = useCallback((key: string, message: string) => {
    if (typeof window === "undefined") return;
    try {
      if (message.trim()) {
        localStorage.setItem(`chat-draft-${key}`, message);
      } else {
        localStorage.removeItem(`chat-draft-${key}`);
      }
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  const clearDraftMessage = useCallback((key: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`chat-draft-${key}`);
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  // localStorage utilities for file attachments
  const getDraftAttachments = useCallback(
    (
      key: string,
    ): Array<{
      id: string;
      name: string;
      contentType: string;
      url: string;
      size: number;
    }> => {
      if (typeof window === "undefined") return [];
      try {
        const saved = localStorage.getItem(`chat-attachments-${key}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    },
    [],
  );

  const saveDraftAttachments = useCallback(
    (
      key: string,
      attachments: Array<{
        id: string;
        name: string;
        contentType: string;
        url: string;
        size: number;
      }>,
    ) => {
      if (typeof window === "undefined") return;
      try {
        if (attachments.length > 0) {
          localStorage.setItem(
            `chat-attachments-${key}`,
            JSON.stringify(attachments),
          );
        } else {
          localStorage.removeItem(`chat-attachments-${key}`);
        }
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    [],
  );

  const clearDraftAttachments = useCallback((key: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`chat-attachments-${key}`);
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  // Local uncontrolled message state – isolated from parent re-renders
  const [message, setMessage] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

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
    const container = inputContainerRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max height of 120px (about 5 lines)
      textarea.style.height = `${newHeight}px`;

      // Report total input container height to parent
      if (container && onHeightChange) {
        // Get the full height of the input container including padding and borders
        const containerHeight = container.offsetHeight;
        onHeightChange(containerHeight);
      }
    }
  }, [onHeightChange]);

  // Load draft message and attachments when thread changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const draftMessage = getDraftMessage(currentThreadKey);
      const draftAttachments = getDraftAttachments(currentThreadKey);

      // Only set draft if there's no preset message
      if (!presetMessage) {
        setMessage(draftMessage);
        // Auto-resize after setting draft message
        setTimeout(autoResize, 0);
      }

      // Restore draft attachments
      if (draftAttachments.length > 0) {
        // Add each attachment to file preview context
        draftAttachments.forEach((attachment) => {
          addFilePreview(attachment);
        });
        // Set attachment IDs
        setAttachmentIds(draftAttachments.map((att) => att.id));
      }
    }
  }, [
    currentThreadKey,
    getDraftMessage,
    getDraftAttachments,
    autoResize,
    presetMessage,
    addFilePreview,
  ]);

  // Keep local state in sync when presetMessage changes (takes priority over draft)
  useEffect(() => {
    if (presetMessage) {
      setMessage(presetMessage);
      // Auto-resize after setting preset message
      setTimeout(autoResize, 0);
    }
  }, [presetMessage, autoResize]);

  // Save draft message whenever message changes (debounced)
  useEffect(() => {
    // Don't save preset messages as drafts
    if (presetMessage && message === presetMessage) return;

    const timeoutId = setTimeout(() => {
      saveDraftMessage(currentThreadKey, message);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [message, currentThreadKey, saveDraftMessage, presetMessage]);

  // Save draft attachments whenever attachments change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveDraftAttachments(currentThreadKey, attachmentPreviews);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [attachmentPreviews, currentThreadKey, saveDraftAttachments]);

  // Auto-resize when message changes
  useEffect(() => {
    autoResize();
  }, [message, autoResize]);

  // Report initial height on mount
  useEffect(() => {
    autoResize();
  }, [autoResize]);

  const isRateLimited = isAnonymous && !canSendMessage;
  // Update disabled logic - no longer disable input during streaming
  const isDisabled = isRateLimited; // Remove isLoading from disabled state

  // Determine button state based on AI SDK status
  const isStreaming = status === "streaming" || status === "submitted";
  const canSend =
    (message.trim() || attachmentPreviews.length > 0) &&
    !isDisabled &&
    !isUploading &&
    status === "ready";
  const canStop = isStreaming && onStop;

  // Handle send or stop action
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
  ]);

  // Enhanced button title with partial save feedback
  const getButtonTitle = () => {
    if (isSavingPartial) return "Saving partial response...";
    if (canStop) return "Stop generation and save partial response";
    if (canSend) return "Send message";
    return "Type a message to send";
  };

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

  return (
    <>
      {/* Rate Limiting Warning for Anonymous Users */}
      {isMounted &&
        isAnonymous &&
        isLoaded &&
        warningLevel &&
        warningLevel.color &&
        warningLevel.level &&
        typeof remainingMessages === "number" &&
        remainingMessages >= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mx-auto w-full sm:w-[95%] md:w-[90%] px-3 sm:px-4 py-2 border-x-2 ${
              warningLevel.color === "red"
                ? "bg-red-50/90 dark:bg-dark-bg-tertiary/80 border-red-300 dark:border-red-500/50"
                : warningLevel.color === "orange"
                  ? "bg-orange-50/90 dark:bg-dark-bg-tertiary/80 border-orange-300 dark:border-orange-500/50"
                  : "bg-yellow-50/90 dark:bg-dark-bg-tertiary/80 border-yellow-300 dark:border-yellow-500/50"
            }`}
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <AlertTriangle
                className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${
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
      {isMounted &&
        isAnonymous &&
        isLoaded &&
        isRateLimited &&
        !canSendMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full sm:w-[95%] md:w-[90%] px-3 sm:px-4 py-3 border-x-2 bg-red-50/90 dark:bg-dark-bg-tertiary/80 border-red-300 dark:border-red-500/50"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="font-medium text-red-800 dark:text-red-200">
                Message limit reached! Sign up to continue chatting or wait 24
                hours for reset.
              </span>
            </div>
          </motion.div>
        )}

      {/* File Attachments Preview */}
      {attachmentPreviews.length > 0 && (
        <FilePreview files={attachmentPreviews} onRemove={removeAttachment} />
      )}

      {/* Clean Chat Input Area */}
      <div
        ref={inputContainerRef}
        className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto bg-purple-50/30 dark:bg-dark-bg/50 z-50"
      >
        <div className="mx-auto w-full sm:w-[95%] md:w-[90%] lg:w-[80%] p-2 sm:p-2 md:p-3 border-t-2 border-l-2 border-r-2 border-purple-300 dark:border-dark-purple-accent rounded-t-xl bg-purple-100/90 dark:bg-dark-bg-secondary/90">
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
              className={`p-2 sm:p-3 rounded-xl bg-white dark:bg-dark-bg-tertiary border-2 border-purple-300 dark:border-dark-purple-accent shadow-lg shadow-purple-500/10 focus-within:border-purple-500 dark:focus-within:border-dark-purple-glow focus-within:shadow-purple-500/20 dark:focus-within:shadow-dark-purple-glow/20 transition-all duration-300 ${
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
                        className="text-xs sm:text-sm text-purple-700 dark:text-slate-300 font-medium"
                      >
                        {isRateLimited
                          ? "Message limit reached. Sign up to continue..."
                          : isStreaming
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
                  className="border-none shadow-none bg-transparent focus-visible:ring-0 text-xs sm:text-sm placeholder:text-transparent resize-none min-h-[24px] font-medium transition-all duration-200 w-full text-purple-900 dark:text-slate-200 p-0 overflow-y-auto"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendOrStop();
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
          <div className="flex items-center justify-between gap-2 mt-2 px-1">
            {/* Model selector and action buttons */}
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto flex-1 min-w-0">
              <Select
                value={_hasHydrated ? selectedModel : "gemini-2.0-flash"}
                onValueChange={(newModel) => {
                  setSelectedModel(newModel as ModelId);
                }}
                disabled={isDisabled}
              >
                <SelectTrigger className="group w-auto min-w-20 sm:min-w-32 md:min-w-40 border-2 border-purple-300 dark:border-dark-purple-accent bg-white dark:bg-dark-bg-tertiary backdrop-blur-md text-xs text-purple-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-dark-bg-secondary hover:border-purple-400 dark:hover:border-dark-purple-glow rounded-lg h-8 sm:h-9 shadow-lg shadow-purple-500/10 transition-all duration-300 hover:shadow-purple-500/20 dark:hover:shadow-dark-purple-glow/20 hover:scale-[1.02] flex-shrink-0">
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <img
                        src={currentModelInfo.icon}
                        alt={currentModelInfo.name}
                        className="h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <span className="font-semibold tracking-wide truncate text-xs sm:text-xs">
                      {currentModelInfo.name}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent className="border-2 border-purple-300 dark:border-dark-purple-accent bg-white dark:bg-dark-bg-tertiary backdrop-blur-xl shadow-2xl shadow-purple-500/25 dark:shadow-dark-purple-glow/25 rounded-xl p-1 w-full max-w-xs">
                  {availableModels.map((modelId) => {
                    const modelInfo = getModelInfo(modelId);
                    return (
                      <SelectItem
                        key={modelId}
                        value={modelId}
                        className={`rounded-lg hover:bg-purple-50 dark:hover:bg-dark-bg-secondary transition-all duration-200 hover:scale-[1.02] focus:bg-gradient-to-r ${
                          modelInfo.theme === "blue"
                            ? "focus:from-blue-500/10 focus:to-blue-600/10"
                            : modelInfo.theme === "green"
                              ? "focus:from-green-500/10 focus:to-green-600/10"
                              : "focus:from-orange-500/10 focus:to-orange-600/10"
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 py-1">
                          <div className="relative">
                            <img
                              src={modelInfo.icon}
                              alt={modelInfo.name}
                              className="h-4 w-4 sm:h-5 sm:w-5"
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
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-xs sm:text-sm">
                              {modelInfo.name}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              {modelInfo.capabilities.vision && (
                                <Eye className="h-3 w-3 text-blue-500" />
                              )}
                              {modelInfo.capabilities.thinking && (
                                <Brain className="h-3 w-3 text-amber-500" />
                              )}
                              {modelInfo.capabilities.tools && (
                                <Wrench className="h-3 w-3 text-green-500" />
                              )}
                              {modelInfo.capabilities.imageGeneration && (
                                <Image className="h-3 w-3 text-purple-500" />
                              )}
                              {modelInfo.capabilities.multimodal && (
                                <Layers className="h-3 w-3 text-indigo-500" />
                              )}
                              {modelInfo.capabilities.fastResponse && (
                                <Zap className="h-3 w-3 text-yellow-500" />
                              )}
                              {modelInfo.capabilities.longContext && (
                                <FileText className="h-3 w-3 text-cyan-500" />
                              )}
                            </div>
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
                className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer text-purple-600 dark:text-slate-400 hover:text-purple-700 dark:hover:text-slate-300 hover:bg-purple-100 dark:hover:bg-dark-bg-secondary rounded-lg flex-shrink-0"
                title="Attach files (images, PDFs, text)"
                disabled={isDisabled}
                onClick={() =>
                  triggerFileSelect("image/*,application/pdf,text/*")
                }
              >
                <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 sm:h-9 sm:w-9 cursor-pointer rounded-lg transition-all duration-200 flex-shrink-0 ${
                  enableWebBrowsing
                    ? "text-emerald-600 hover:text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/40"
                    : "text-gray-600 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-dark-bg-secondary"
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
                <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>

            {/* Send/Stop Button */}
            <Button
              size="icon"
              variant={canSend || canStop ? "default" : "ghost"}
              className={`h-8 w-8 sm:h-9 sm:w-9 cursor-pointer shrink-0 transition-all duration-200 ml-2 ${
                canSend || canStop
                  ? "bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl hover:scale-105"
                  : "text-purple-400 dark:text-purple-500 cursor-not-allowed"
              } ${isSavingPartial ? "animate-pulse bg-orange-500 hover:bg-orange-600" : ""}`}
              onClick={handleSendOrStop}
              disabled={(!canSend && !canStop) || isSavingPartial}
              title={getButtonTitle()}
            >
              {isSavingPartial ? (
                <div className="h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : canStop ? (
                <Square className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Send className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
});

export { ChatInput };
