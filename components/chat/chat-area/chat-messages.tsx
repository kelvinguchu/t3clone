import { useState } from "react";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";

// Message handling utilities
import { useMessageActionHandlers } from "@/lib/actions/chat/chat-area/message-action-handlers";
import { useMessageStateManager } from "@/lib/actions/chat/chat-area/message-state-manager";

// UI components
import { CompactLoadingIndicator } from "./compact-loading-indicator";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";

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
  // Control which action buttons to show
  showActionButtons?: {
    copy?: boolean;
    retry?: boolean;
    branch?: boolean;
  };
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
  showActionButtons = { copy: true, retry: true, branch: true },
}: ChatMessagesProps) {
  // Message action handlers
  const { copiedIndex, handleCopy, handleRetry } = useMessageActionHandlers({
    reload,
  });

  // Message state management
  const {
    isLatestAssistantMessage,
    isCurrentStreaming,
    extractReasoning,
    shouldShowThinkingForMessage,
    getForceExpandedState,
  } = useMessageStateManager({
    messages,
    isLoading,
  });

  // Track which branch popover is open (by message index)
  const [branchPopover, setBranchPopover] = useState<number | null>(null);

  // Anonymous session for authorization
  const { sessionId } = useAnonymousSession();

  return (
    // Root grows to fill its parent but no artificial spacer
    <div className="flex flex-col min-h-full">
      <div className="w-full max-w-4xl mx-auto space-y-3 sm:space-y-4 p-3 sm:p-4 flex-1">
        {/* Render conversation messages */}
        {messages.map((msg, index) => {
          // Skip empty assistant messages during tool calls to avoid layout shift
          if (
            msg.role === "assistant" &&
            (msg.content ?? "").trim().length === 0 &&
            isLoading &&
            index === messages.length - 1 &&
            (!msg.toolInvocations || msg.toolInvocations.length === 0)
          ) {
            return null;
          }

          if (msg.role === "user") {
            return <UserMessage key={index} message={msg} index={index} />;
          }

          // Assistant message
          return (
            <AssistantMessage
              key={index}
              message={msg}
              index={index}
              messagesLength={messages.length}
              extractReasoning={extractReasoning}
              shouldShowThinkingForMessage={shouldShowThinkingForMessage}
              getForceExpandedState={getForceExpandedState}
              isCurrentStreaming={isCurrentStreaming}
              isLatestAssistantMessage={isLatestAssistantMessage}
              handleCopy={handleCopy}
              handleRetry={handleRetry}
              copiedIndex={copiedIndex}
              isLoading={isLoading}
              isThinkingPhase={isThinkingPhase}
              shouldShowThinkingDisplay={shouldShowThinkingDisplay}
              hasStartedResponding={hasStartedResponding}
              threadId={threadId}
              sessionId={sessionId}
              branchPopover={branchPopover}
              setBranchPopover={setBranchPopover}
              showActionButtons={showActionButtons}
            />
          );
        })}

        {/* Loading indicators for immediate feedback */}
        {isLoading && loadingStatusText && (
          <CompactLoadingIndicator text={loadingStatusText} />
        )}
      </div>
    </div>
  );
}
