import { Globe } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { AiOutlineCopy } from "react-icons/ai";
import { FiRefreshCw } from "react-icons/fi";
import { ChatMessageAttachments } from "./chat-message-attachments";
import { ThinkingDisplay } from "./thinking-display";
import { BranchingPopover } from "./branching-popover";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Validates if a string is a valid Convex ID format
 * Convex IDs are base64-encoded strings that follow specific patterns
 */
function isValidConvexId(id: string | undefined): boolean {
  if (!id) return false;

  // AI SDK temporary IDs are shorter and don't follow Convex format
  if (id.startsWith("msg-") || id.startsWith("msgc") || id.startsWith("msgs")) {
    return false;
  }

  // Convex IDs are typically longer (20+ chars) and follow specific patterns
  // They often contain underscores and are base64-encoded
  if (id.length < 20) return false;

  // Basic format check - Convex IDs are alphanumeric with underscores
  if (!/^[a-zA-Z0-9_]+$/.test(id)) return false;

  // Most Convex IDs contain underscores as part of their encoding
  if (!id.includes("_")) return false;

  return true;
}

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

export interface AssistantMessageProps {
  message: DisplayMessage;
  index: number;
  messagesLength: number; // For streaming cursor logic
  // State management functions
  extractReasoning: (message: DisplayMessage) => string | undefined;
  shouldShowThinkingForMessage: (
    message: DisplayMessage,
    index: number,
    isThinkingPhase?: boolean,
    shouldShowThinkingDisplay?: boolean,
  ) => boolean;
  getForceExpandedState: (
    index: number,
    isThinkingPhase?: boolean,
    hasStartedResponding?: boolean,
  ) => { forceExpanded: boolean; forceCollapsed: boolean };
  isCurrentStreaming: (index: number) => boolean;
  isLatestAssistantMessage: (index: number) => boolean;
  // Action handlers
  handleCopy: (content: string, index: number) => Promise<void>;
  handleRetry: () => Promise<void>;
  copiedIndex: number | null;
  // UI state
  isLoading: boolean;
  isThinkingPhase?: boolean;
  shouldShowThinkingDisplay?: boolean;
  hasStartedResponding?: boolean;
  threadId?: string | null;
  sessionId: string | null;
  branchPopover: number | null;
  setBranchPopover: (value: number | null) => void;
  // Control which action buttons to show
  showActionButtons?: {
    copy?: boolean;
    retry?: boolean;
    branch?: boolean;
  };
}

/**
 * Assistant Message Component
 * Extracted from chat-messages.tsx
 */
export function AssistantMessage({
  message: msg,
  index,
  messagesLength,
  extractReasoning,
  shouldShowThinkingForMessage,
  getForceExpandedState,
  isCurrentStreaming,
  isLatestAssistantMessage,
  handleCopy,
  handleRetry,
  copiedIndex,
  isLoading,
  isThinkingPhase,
  shouldShowThinkingDisplay,
  hasStartedResponding,
  threadId,
  sessionId,
  branchPopover,
  setBranchPopover,
  showActionButtons = { copy: true, retry: true, branch: true },
}: AssistantMessageProps) {
  const currentReasoning = extractReasoning(msg);

  // Use Convex query to check if this message is the latest assistant message
  // Only query if we have a message ID that is a valid Convex ID
  // AI SDK generates temporary IDs that don't match Convex format, so we need to validate properly
  const shouldQueryDB = isValidConvexId(msg.id);

  const isLatestFromDB = useQuery(
    api.messages.isLatestAssistantMessage,
    shouldQueryDB
      ? {
          messageId: msg.id as Id<"messages">,
          ...(sessionId ? { sessionId } : {}),
        }
      : "skip",
  );

  // Use extracted state management functions
  const shouldShowThinkingForThisMessage = shouldShowThinkingForMessage(
    msg,
    index,
    isThinkingPhase,
    shouldShowThinkingDisplay,
  );

  const { forceExpanded, forceCollapsed } = getForceExpandedState(
    index,
    isThinkingPhase,
    hasStartedResponding,
  );

  return (
    <div key={index} className="flex justify-start mb-4 sm:mb-6">
      <div className="w-full max-w-4xl mx-auto">
        {/* Enhanced thinking display logic */}
        {shouldShowThinkingForThisMessage && (
          <ThinkingDisplay
            reasoning={currentReasoning ?? ""} // Show even if empty during thinking phase
            isStreaming={isCurrentStreaming(index)}
            forceExpanded={forceExpanded}
            forceCollapsed={forceCollapsed}
          />
        )}

        {/* Only show content if we have actual content or not in pure thinking phase */}
        {(msg.content.trim() || !isThinkingPhase || hasStartedResponding) && (
          <div className="whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100 text-sm sm:text-base">
            <Markdown content={msg.content} />
            {/* Show streaming cursor for the last assistant message during streaming */}
            {isLoading &&
              msg.role === "assistant" &&
              index === messagesLength - 1 &&
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
        {!isCurrentStreaming(index) && (
          <div className="flex items-center gap-4 sm:gap-3 mt-2 text-purple-600 dark:text-slate-400 text-xs sm:text-sm">
            {showActionButtons?.copy && (
              <button
                onClick={() => handleCopy(msg.content, index)}
                aria-label="Copy response"
                className="cursor-pointer hover:text-purple-700 dark:hover:text-slate-300 transition-colors p-1 sm:p-2 rounded-md hover:bg-purple-50 dark:hover:bg-dark-bg-tertiary/50"
              >
                {copiedIndex === index ? (
                  <span className="text-green-500 text-[10px] sm:text-[12px] select-none">
                    Copied
                  </span>
                ) : (
                  <AiOutlineCopy className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            )}
            {/* Only show retry button for the latest assistant message */}
            {showActionButtons?.retry && isLatestAssistantMessage(index) && (
              <button
                onClick={handleRetry}
                aria-label="Retry"
                className="cursor-pointer hover:text-purple-700 dark:hover:text-slate-300 transition-colors p-1 sm:p-2 rounded-md hover:bg-purple-50 dark:hover:bg-dark-bg-tertiary/50"
              >
                <FiRefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}
            {/* Show branch button - use local logic as fallback while DB query loads */}
            {showActionButtons?.branch &&
              msg.id && // Ensure msg.id is defined
              msg.content &&
              msg.content.trim().length > 0 && // Must have content to branch from
              (shouldQueryDB
                ? (isLatestFromDB ?? isLatestAssistantMessage(index)) // Use DB result if available, fallback to local logic
                : isLatestAssistantMessage(index)) && ( // For non-Convex IDs, use local logic only
                <BranchingPopover
                  messageId={msg.id}
                  threadId={threadId!}
                  sessionId={sessionId}
                  isOpen={branchPopover === index}
                  onOpenChange={(o) => setBranchPopover(o ? index : null)}
                />
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
}
