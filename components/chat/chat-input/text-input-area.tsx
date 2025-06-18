"use client";

import { Textarea } from "@/components/ui/textarea";
import { AnimatePresence, motion } from "motion/react";
import { forwardRef } from "react";

export interface TextInputAreaProps {
  // Message state
  message: string;
  setMessage: (message: string) => void;

  // Placeholder animation
  placeholderIndex: number;
  placeholderTexts: string[];

  // Status states
  isRateLimited: boolean;
  isStreaming: boolean;
  isUploading: boolean;
  isDisabled: boolean;

  // Attachments
  attachmentPreviews: Array<{
    id: string;
    name: string;
    contentType: string;
    url: string;
    size: number;
  }>;

  // Action handlers
  handleSendOrStop: () => void;
}

/**
 * Text input area component extracted from original chat-input.tsx lines 700-764
 * Contains the main textarea with animated placeholder and input container styling
 */
export const TextInputArea = forwardRef<
  HTMLTextAreaElement,
  TextInputAreaProps
>(function TextInputArea(
  {
    message,
    setMessage,
    placeholderIndex,
    placeholderTexts,
    isRateLimited,
    isStreaming,
    isUploading,
    isDisabled,
    attachmentPreviews,
    handleSendOrStop,
  },
  ref,
) {
  return (
    /* Main Input Container - extracted from lines 700-764 */
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
        {/* Textarea Container - extracted from lines 712-764 */}
        <div className="relative min-h-[24px]">
          {/* Animated Placeholder - extracted from lines 713-738 */}
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

          {/* Main Textarea - extracted from lines 741-764 */}
          <Textarea
            ref={ref}
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
  );
});

/**
 * Utility function to get input container classes based on state
 */
export function getInputContainerClasses(
  message: string,
  attachmentPreviews: Array<{ id: string }>,
  isDisabled: boolean,
): string {
  const baseClasses =
    "p-2 sm:p-3 rounded-xl bg-white dark:bg-dark-bg-tertiary border-2 border-purple-300 dark:border-dark-purple-accent shadow-lg shadow-purple-500/10 focus-within:border-purple-500 dark:focus-within:border-dark-purple-accent focus-within:shadow-purple-500/20 dark:focus-within:shadow-none transition-all duration-300";

  const hoverClasses =
    !message.trim() && attachmentPreviews.length === 0
      ? "hover:shadow-purple-500/30 dark:hover:shadow-none"
      : "";

  const disabledClasses = isDisabled
    ? "opacity-50 cursor-not-allowed border-red-300 dark:border-red-600"
    : "";

  return `${baseClasses} ${hoverClasses} ${disabledClasses}`.trim();
}

/**
 * Utility function to get placeholder text based on current state
 */
export function getPlaceholderText(
  isRateLimited: boolean,
  isStreaming: boolean,
  isUploading: boolean,
  placeholderTexts: string[],
  placeholderIndex: number,
): string {
  if (isRateLimited) {
    return "Message limit reached. Sign up to continue...";
  }
  if (isStreaming) {
    return "Generating...";
  }
  if (isUploading) {
    return "Uploading files...";
  }
  return placeholderTexts[placeholderIndex];
}
