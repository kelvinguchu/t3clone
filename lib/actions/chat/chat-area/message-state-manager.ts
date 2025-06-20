import { useMemo } from "react";

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

export interface MessageStateManagerParams {
  messages: DisplayMessage[];
  isLoading: boolean;
}

export interface MessageStateManagerReturn {
  isLatestAssistantMessage: (index: number) => boolean;
  isCurrentStreaming: (index: number) => boolean;
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
}

/**
 * Custom hook for managing message state calculations
 * Extracted from chat-messages.tsx
 */
export function useMessageStateManager({
  messages,
  isLoading,
}: MessageStateManagerParams): MessageStateManagerReturn {
  // Check if this is the latest assistant message
  const isLatestAssistantMessage = useMemo(() => {
    return (index: number) => {
      // Find the last assistant message index
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "assistant") {
          return i === index;
        }
      }
      return false;
    };
  }, [messages]);

  const isCurrentStreaming = useMemo(() => {
    return (index: number) => isLoading && index === messages.length - 1;
  }, [isLoading, messages.length]);

  // Extract reasoning from message parts or direct property
  const extractReasoning = useMemo(() => {
    return (message: DisplayMessage): string | undefined => {
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
  }, []);

  // Determine if this is the current streaming message
  const isCurrentStreamingMessage = useMemo(() => {
    return (index: number) =>
      isLoading &&
      index === messages.length - 1 &&
      messages[index]?.role === "assistant";
  }, [isLoading, messages]);

  // Show thinking display for messages
  const shouldShowThinkingForMessage = useMemo(() => {
    return (
      message: DisplayMessage,
      index: number,
      isThinkingPhase = false,
      shouldShowThinkingDisplay = false,
    ): boolean => {
      const currentReasoning = extractReasoning(message);

      // For historical messages we still require reasoning content, but for the
      // **currently streaming assistant message** we want to show the collapsed
      // placeholder immediately even before any reasoning tokens arrive.
      const currentStreamingMessage = isCurrentStreamingMessage(index);

      if (!currentReasoning || currentReasoning.trim().length === 0) {
        // Only allow empty-reasoning display for the streaming message while
        // the thinking phase is active.
        if (
          !(
            currentStreamingMessage &&
            (isThinkingPhase || shouldShowThinkingDisplay)
          )
        ) {
          return false;
        }
      }

      // If we're not currently loading/streaming, then ALL messages are historical
      // Show ThinkingDisplay for any historical message with reasoning
      if (!isLoading) {
        return true;
      }

      // If we ARE loading/streaming, then only the last assistant message is "current"
      if (!currentStreamingMessage) {
        // Historical message during active session - always show if has reasoning
        return true;
      }

      // Current streaming message - use enhanced logic
      return shouldShowThinkingDisplay || isThinkingPhase;
    };
  }, [isLoading, isCurrentStreamingMessage, extractReasoning]);

  // Force expanded state during thinking phase, auto-collapse when responding starts
  const getForceExpandedState = useMemo(() => {
    return (
      index: number,
      isThinkingPhase = false,
      hasStartedResponding = false,
    ) => {
      const currentStreamingMessage = isCurrentStreamingMessage(index);

      // Only apply to the current streaming message
      const forceExpanded = currentStreamingMessage && isThinkingPhase;
      const forceCollapsed =
        currentStreamingMessage && hasStartedResponding && !isThinkingPhase;

      return { forceExpanded, forceCollapsed };
    };
  }, [isCurrentStreamingMessage]);

  return {
    isLatestAssistantMessage,
    isCurrentStreaming,
    extractReasoning,
    shouldShowThinkingForMessage,
    getForceExpandedState,
  };
}
