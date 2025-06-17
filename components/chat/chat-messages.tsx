import { useState } from "react";
import { GitBranch, Globe, Brain } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { AiOutlineCopy } from "react-icons/ai";
import { FiRefreshCw } from "react-icons/fi";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAvailableModels, getModelInfo } from "@/lib/ai-providers";
import { ChatMessageAttachments } from "./chat-message-attachments";
import { ThinkingDisplay } from "./thinking-display";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";
import type { Id } from "@/convex/_generated/dataModel";

type DisplayMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  id?: string;
  model?: string;
  // Tool usage tracking from database
  toolsUsed?: string[];
  hasToolCalls?: boolean;
  // Reasoning/thinking tokens from AI models
  reasoning?: string;
  // Message parts from AI SDK (for streaming reasoning)
  parts?: Array<{
    type: string;
    text?: string;
    reasoning?: string;
  }>;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    url: string;
    size?: number;
  }>;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
    result?: unknown;
    state: "partial-call" | "call" | "result";
  }>;
};

export interface ChatMessagesProps {
  messages: DisplayMessage[];
  isLoading: boolean;
  loadingStatusText?: string | null;
  threadId?: string | null;
  // AI SDK reload function for retry functionality
  reload?: () => Promise<string | null | undefined>;
  // Enhanced thinking phase props
  isThinkingPhase?: boolean;
  shouldShowThinkingDisplay?: boolean;
  hasStartedResponding?: boolean;
}

// Compact Loading Indicator Component
function CompactLoadingIndicator({ text }: { text: string | null }) {
  const isBrowsing = text === "Browsing...";
  const isThinking = text === "Thinking...";
  const isDefault = !text; // When text is null, show default animated dots

  if (isDefault) {
    // Default loading state - just animated dots
    return (
      <div className="flex justify-start mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border shadow-sm max-w-fit bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border shadow-sm max-w-fit ${
          isBrowsing
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-600"
            : isThinking
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-600"
              : "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-600"
        }`}
      >
        {isBrowsing ? (
          <>
            <Globe className="h-3 w-3 text-emerald-600 animate-spin" />
            <span className="text-emerald-700 dark:text-emerald-300">
              {text}
            </span>
          </>
        ) : isThinking ? (
          <>
            <Brain className="h-3 w-3 text-amber-600 animate-pulse" />
            <span className="text-amber-700 dark:text-amber-300">{text}</span>
          </>
        ) : (
          <>
            <div className="h-3 w-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-purple-700 dark:text-purple-300">{text}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  isLoading,
  loadingStatusText,
  threadId,
  reload,
  isThinkingPhase,
  shouldShowThinkingDisplay,
  hasStartedResponding,
}: ChatMessagesProps) {
  // Track which assistant message was recently copied
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Track which branch popover is open (by message index)
  const [branchPopover, setBranchPopover] = useState<number | null>(null);

  // Router for navigation
  const router = useRouter();

  // Anonymous session for authorization
  const { sessionId } = useAnonymousSession();

  // Branch thread mutation
  const branchThread = useMutation(api.threads.branchThread);

  return (
    // Root grows to fill its parent but no artificial spacer – avoids layout shift
    <div className="flex flex-col min-h-full">
      <div className="w-full max-w-4xl mx-auto space-y-3 sm:space-y-4 p-3 sm:p-4 md:p-6 flex-1 flex flex-col justify-end">
        {/* Render conversation messages */}
        {messages.map((msg, index) => {
          // -------------------------------------------------------------
          // Skip rendering the placeholder assistant message that is
          // still empty while the LLM is busy with tool-calls (browsing).
          // We will instead show a dedicated indicator further below.
          // -------------------------------------------------------------
          if (
            msg.role === "assistant" &&
            (msg.content ?? "").trim().length === 0 &&
            isLoading &&
            index === messages.length - 1
          ) {
            return null;
          }

          if (msg.role === "user") {
            return (
              <div key={index} className="flex justify-end mb-3 sm:mb-4">
                <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ml-2 sm:ml-4">
                  {/* User message content */}
                  <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-purple-600 text-white">
                    <div className="whitespace-pre-wrap break-words text-sm sm:text-base">
                      <Markdown content={msg.content} />
                    </div>
                  </div>

                  {/* User message attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2">
                      <ChatMessageAttachments
                        attachments={msg.attachments}
                        maxHeight={200}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Assistant message
          const handleCopy = async () => {
            try {
              // Try modern clipboard API first
              if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(msg.content);
              } else {
                // Fallback for mobile/older browsers
                const textArea = document.createElement("textarea");
                textArea.value = msg.content;
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
          };

          const handleRetry = async () => {
            // Use AI SDK's reload function for proper retry functionality
            if (reload && messages[index - 1]?.role === "user") {
              try {
                await reload();
              } catch (error) {
                console.error("Failed to retry message:", error);
                // Import and use error handler
                if (error instanceof Error) {
                  const { handleChatError } = await import(
                    "@/lib/utils/error-handler"
                  );
                  handleChatError(error, handleRetry);
                }
              }
            }
          };

          // Check if this is the latest assistant message
          const isLatestAssistantMessage = (() => {
            // Find the last assistant message index
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].role === "assistant") {
                return i === index;
              }
            }
            return false;
          })();

          const isCurrentStreaming = isLoading && index === messages.length - 1;

          // Extract reasoning from message parts or direct property
          const extractReasoning = (
            message: DisplayMessage,
          ): string | undefined => {
            // First check message parts (for streaming reasoning)
            if (message.parts) {
              const reasoningParts = message.parts.filter(
                (part) => part.type === "reasoning",
              );
              if (reasoningParts.length > 0) {
                const extracted = reasoningParts
                  .map((part) => part.reasoning || "")
                  .join("\n");
                return extracted;
              }
            }
            // Fallback to direct reasoning property (from database)
            return message.reasoning;
          };

          const currentReasoning = extractReasoning(msg);

          // Determine if this is the current streaming message
          const isCurrentStreamingMessage =
            isLoading &&
            index === messages.length - 1 &&
            msg.role === "assistant";

          // Show thinking display for:
          // 1. Any historical assistant message with reasoning content (always show)
          // 2. Current streaming message with enhanced logic
          const shouldShowThinkingForThisMessage = (() => {
            // Must have reasoning content
            if (!currentReasoning || currentReasoning.trim().length === 0) {
              return false;
            }

            // If we're not currently loading/streaming, then ALL messages are historical
            // Show ThinkingDisplay for any historical message with reasoning
            if (!isLoading) {
              return true;
            }

            // If we ARE loading/streaming, then only the last assistant message is "current"
            const isCurrentStreamingMessage =
              isLoading &&
              index === messages.length - 1 &&
              msg.role === "assistant";

            if (!isCurrentStreamingMessage) {
              // Historical message during active session - always show if has reasoning
              return true;
            }

            // Current streaming message - use enhanced logic
            return shouldShowThinkingDisplay || isThinkingPhase;
          })();

          // Force expanded state during thinking phase, auto-collapse when responding starts
          // Only apply to the current streaming message
          const forceExpanded = isCurrentStreamingMessage && isThinkingPhase;
          const forceCollapsed =
            isCurrentStreamingMessage &&
            hasStartedResponding &&
            !isThinkingPhase;

          return (
            <div key={index} className="flex justify-start mb-4 sm:mb-6">
              <div className="w-full max-w-4xl mx-auto">
                {/* Enhanced thinking display logic */}
                {shouldShowThinkingForThisMessage && (
                  <ThinkingDisplay
                    reasoning={currentReasoning ?? ""} // Show even if empty during thinking phase
                    isStreaming={isCurrentStreamingMessage}
                    forceExpanded={forceExpanded}
                    forceCollapsed={forceCollapsed}
                  />
                )}

                {/* Only show content if we have actual content or not in pure thinking phase */}
                {(msg.content.trim() ||
                  !isThinkingPhase ||
                  hasStartedResponding) && (
                  <div className="whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                    <Markdown content={msg.content} />
                    {/* Show streaming cursor for the last assistant message during streaming */}
                    {isLoading &&
                      msg.role === "assistant" &&
                      index === messages.length - 1 &&
                      !isThinkingPhase && ( // Don't show cursor during thinking phase
                        <span className="inline-block w-1.5 sm:w-2 h-4 sm:h-5 bg-purple-500 animate-pulse ml-1" />
                      )}
                  </div>
                )}

                {/* Assistant message attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <ChatMessageAttachments
                    attachments={msg.attachments}
                    maxHeight={250}
                  />
                )}
                {/* Action buttons (copy / retry / branch) – only once streaming is finished */}
                {!isCurrentStreaming && (
                  <div className="flex items-center gap-4 sm:gap-3 mt-2 text-purple-600 dark:text-purple-400 text-xs sm:text-sm">
                    <button
                      onClick={handleCopy}
                      aria-label="Copy response"
                      className="cursor-pointer hover:text-purple-700 dark:hover:text-purple-300 transition-colors p-1 sm:p-2 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/30"
                    >
                      {copiedIndex === index ? (
                        <span className="text-green-500 text-[10px] sm:text-[12px] select-none">
                          Copied
                        </span>
                      ) : (
                        <AiOutlineCopy className="h-4 w-4 sm:h-5 sm:w-5" />
                      )}
                    </button>
                    {/* Only show retry button for the latest assistant message */}
                    {isLatestAssistantMessage && (
                      <button
                        onClick={handleRetry}
                        aria-label="Retry"
                        className="cursor-pointer hover:text-purple-700 dark:hover:text-purple-300 transition-colors p-1 sm:p-2 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/30"
                      >
                        <FiRefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    )}
                    {/* Only show branch button for the latest assistant message */}
                    {msg.id && isLatestAssistantMessage && (
                      <Popover
                        open={branchPopover === index}
                        onOpenChange={(o) => setBranchPopover(o ? index : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            aria-label="Branch conversation"
                            className="cursor-pointer hover:text-purple-700 dark:hover:text-purple-300 transition-colors p-1 sm:p-2 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/30"
                          >
                            <GitBranch className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 sm:w-60 p-3 sm:p-4 space-y-2 sm:space-y-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200 dark:border-purple-700 shadow-xl shadow-purple-500/10 dark:shadow-purple-900/20">
                          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide select-none">
                            Choose model to branch with
                          </p>
                          <div className="space-y-1 sm:space-y-1.5">
                            {getAvailableModels().map((mId) => {
                              const info = getModelInfo(mId);
                              return (
                                <button
                                  key={mId}
                                  onClick={async () => {
                                    if (!threadId || !msg.id) return;

                                    try {
                                      // Call the branchThread mutation
                                      const newThreadId = await branchThread({
                                        sourceThreadId:
                                          threadId as Id<"threads">,
                                        branchFromMessageId:
                                          msg.id as Id<"messages">,
                                        model: mId,
                                        ...(sessionId ? { sessionId } : {}),
                                      });

                                      // Navigate to the new branched thread
                                      router.push(`/chat/${newThreadId}`);

                                      // Close the popover
                                      setBranchPopover(null);
                                    } catch (error) {
                                      console.error(
                                        "Failed to branch thread:",
                                        error,
                                      );
                                      // Could add toast notification here
                                    }
                                  }}
                                  className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-xs sm:text-sm text-left transition-all duration-200 border border-transparent hover:border-purple-200 dark:hover:border-purple-700 group cursor-pointer"
                                >
                                  <img
                                    src={info.icon}
                                    alt={info.name}
                                    className="h-4 w-4 sm:h-5 sm:w-5 rounded-sm"
                                  />
                                  <span className="flex-1 font-medium text-gray-700 dark:text-gray-200 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                                    {info.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    <span className="ml-auto text-xs text-gray-400 select-none uppercase tracking-wide">
                      <div className="flex items-center gap-1">
                        {/* Show tool usage icon if tools were used */}
                        {msg.hasToolCalls && (
                          <Globe className="h-3 w-3 text-emerald-500" />
                        )}
                        {/* Only show model name for assistant messages, and only if we have the actual model */}
                        {msg.role === "assistant" && msg.model && (
                          <span className="hidden sm:inline">{msg.model}</span>
                        )}
                      </div>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ENHANCED LOADING INDICATORS: Compact and immediate feedback */}
        {isLoading && (
          <CompactLoadingIndicator text={loadingStatusText ?? null} />
        )}
      </div>
    </div>
  );
}
