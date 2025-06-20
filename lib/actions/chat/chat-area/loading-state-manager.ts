import { useMemo, useState, useEffect, useRef } from "react";
import type { Message } from "@ai-sdk/react";

/**
 * Loading phase type
 */
export type LoadingPhase =
  | "generating"
  | "thinking"
  | "browsing"
  | "error"
  | "ready";

/**
 * Extended message type with reasoning and parts
 */
type ExtendedMessage = Message & {
  reasoning?: string;
  parts?: Array<{ type: string; reasoning?: string; text?: string }>;
};

/**
 * Deep comparison for message content to prevent unnecessary recalculations
 */
function messagesContentEqual(a: Message[], b: Message[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const msgA = a[i] as ExtendedMessage;
    const msgB = b[i] as ExtendedMessage;

    if (
      msgA.id !== msgB.id ||
      msgA.role !== msgB.role ||
      msgA.content !== msgB.content
    ) {
      return false;
    }

    // Compare reasoning content for thinking models
    if (msgA.reasoning !== msgB.reasoning) return false;

    // Compare parts for streaming content
    const partsA = msgA.parts;
    const partsB = msgB.parts;
    if (partsA?.length !== partsB?.length) return false;

    if (partsA && partsB) {
      for (let j = 0; j < partsA.length; j++) {
        if (
          partsA[j].type !== partsB[j].type ||
          partsA[j].text !== partsB[j].text ||
          partsA[j].reasoning !== partsB[j].reasoning
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Custom hook that manages effective messages (always uses AI SDK messages)
 * @param hookMessages - Messages from useChat hook
 * @returns Memoized effective messages
 */
export function useEffectiveMessages(hookMessages: Message[]) {
  const previousMessagesRef = useRef<Message[]>([]);

  return useMemo(() => {
    // Always use AI SDK messages for display - they handle streaming perfectly
    // The initial messages from Convex are loaded into the AI SDK via initialMessages

    // Only update if messages actually changed (deep comparison)
    if (!messagesContentEqual(previousMessagesRef.current, hookMessages)) {
      previousMessagesRef.current = hookMessages;
    }

    return previousMessagesRef.current;
  }, [hookMessages]);
}

/**
 * Custom hook that manages loading state with AI SDK status
 * @param status - Status from useChat hook
 * @param hookLoading - Loading state from useChat hook
 * @param effectiveMessages - Effective messages array
 * @returns Memoized loading state
 */
export function useLoadingState(
  status: string,
  hookLoading: boolean,
  effectiveMessages: Message[],
) {
  return useMemo(() => {
    // Immediate feedback based on AI SDK status
    if (status === "submitted" || status === "streaming") return true;

    // Fallback: Check if AI SDK is processing the request
    if (hookLoading) return true;

    // Check if any message in Convex is marked as streaming
    return effectiveMessages.some(
      (m) => (m as { isStreaming?: boolean }).isStreaming,
    );
  }, [status, hookLoading, effectiveMessages]);
}

/**
 * Custom hook that manages loading phase detection
 * @param status - Status from useChat hook
 * @param isThinking - Whether the model is currently thinking
 * @param isBrowsing - Whether the model is currently browsing
 * @returns Memoized loading phase
 */
export function useLoadingPhase(
  status: string,
  isThinking: boolean,
  isBrowsing: boolean,
): LoadingPhase {
  return useMemo(() => {
    if (status === "error") return "error"; // Error occurred
    if (!status || status === "ready") return "ready"; // Ready for new input

    // Determine the specific loading phase
    if (isBrowsing) return "browsing"; // Model is using tools/browsing
    if (isThinking) return "thinking"; // Model is reasoning/thinking
    if (status === "submitted" || status === "streaming") return "generating"; // Model is generating text

    return "ready";
  }, [status, isThinking, isBrowsing]);
}

/**
 * Custom hook that finds the last assistant message
 * @param effectiveMessages - Effective messages array
 * @returns Memoized last assistant message or null
 */
export function useLastAssistantMessage(effectiveMessages: Message[]) {
  const previousLastMessageRef = useRef<{
    messages: Message[];
    lastMessage: Message | null;
  }>({ messages: [], lastMessage: null });

  return useMemo(() => {
    // Only recalculate if messages actually changed
    if (
      !messagesContentEqual(
        previousLastMessageRef.current.messages,
        effectiveMessages,
      )
    ) {
      let lastMessage: Message | null = null;

      for (let i = effectiveMessages.length - 1; i >= 0; i--) {
        if (effectiveMessages[i].role === "assistant") {
          lastMessage = effectiveMessages[i];
          break;
        }
      }

      previousLastMessageRef.current = {
        messages: effectiveMessages,
        lastMessage,
      };
    }

    return previousLastMessageRef.current.lastMessage;
  }, [effectiveMessages]);
}

/**
 * Custom hook that detects if a model is currently thinking (has reasoning content)
 * @param isLoading - Whether chat is loading
 * @param lastAssistantMessage - Last assistant message
 * @param pendingThinking - Whether thinking was initiated
 * @returns Memoized thinking state
 */
export function useThinkingState(
  isLoading: boolean,
  lastAssistantMessage: Message | null,
  pendingThinking: boolean,
) {
  return useMemo(() => {
    if (!pendingThinking || !isLoading || !lastAssistantMessage) return false;

    // Check if the message has reasoning parts (streaming)
    const messageWithParts = lastAssistantMessage as ExtendedMessage;

    if (messageWithParts.parts) {
      const hasReasoningParts = messageWithParts.parts.some(
        (part) => part.type === "reasoning" && part.reasoning,
      );
      if (hasReasoningParts) return true;
    }

    // Check if message has reasoning property
    if (messageWithParts.reasoning) return true;

    // If content is empty but we're loading and thinking was initiated, assume thinking
    return (lastAssistantMessage.content ?? "").trim().length === 0;
  }, [isLoading, lastAssistantMessage, pendingThinking]);
}

/**
 * Custom hook that detects if a model is in thinking phase (reasoning) vs responding phase (generating text)
 * @param isLoading - Whether chat is loading
 * @param lastAssistantMessage - Last assistant message
 * @param pendingThinking - Whether thinking was initiated
 * @returns Object with thinking phase status and should show expanded thinking display
 */
export function useThinkingPhase(
  isLoading: boolean,
  lastAssistantMessage: Message | null,
  pendingThinking: boolean,
) {
  return useMemo(() => {
    if (!pendingThinking || !isLoading || !lastAssistantMessage) {
      return {
        isThinkingPhase: false,
        shouldShowThinkingDisplay: false,
        hasStartedResponding: false,
      };
    }

    const messageWithParts = lastAssistantMessage as ExtendedMessage;

    const hasContent = (lastAssistantMessage.content ?? "").trim().length > 0;
    const hasReasoningContent = (() => {
      // Check parts for reasoning
      if (messageWithParts.parts) {
        return messageWithParts.parts.some(
          (part) => part.type === "reasoning" && part.reasoning,
        );
      }

      // Check direct reasoning property
      return !!messageWithParts.reasoning;
    })();

    // We're in thinking phase if:
    // 1. We have reasoning content but no main content yet, OR
    // 2. We have no content at all (waiting for reasoning to start)
    const isThinkingPhase = hasReasoningContent && !hasContent;
    const hasStartedResponding = hasContent;

    // Show thinking display if we're thinking or if we've started responding but still have reasoning
    const shouldShowThinkingDisplay = hasReasoningContent;

    return {
      isThinkingPhase,
      shouldShowThinkingDisplay,
      hasStartedResponding,
    };
  }, [isLoading, lastAssistantMessage, pendingThinking]);
}

/**
 * Custom hook that manages browsing state detection
 * @param pendingBrowsing - Whether browsing was requested
 * @param isLoading - Whether chat is loading
 * @param lastAssistantMessage - Last assistant message
 * @returns Memoized browsing state
 */
export function useBrowsingState(
  pendingBrowsing: boolean,
  isLoading: boolean,
  lastAssistantMessage: Message | null,
) {
  return useMemo(() => {
    if (!isLoading) return false;

    // Consider browsing active only when an assistant tool invocation is
    // actually running. This prevents early "Searching…" indicators before
    // the model decides to browse.
    if (lastAssistantMessage && "toolInvocations" in lastAssistantMessage) {
      const inv = (
        lastAssistantMessage as Partial<Message> & {
          toolInvocations?: Array<{ state: string }>;
        }
      ).toolInvocations;
      return (
        !!inv &&
        inv.length > 0 &&
        (inv[0].state === "partial-call" || inv[0].state === "call")
      );
    }

    return false;
  }, [isLoading, lastAssistantMessage]);
}

/**
 * Custom hook that manages loading status text
 * @param isLoading - Whether chat is loading
 * @param isThinking - Whether the model is thinking (reasoning)
 * @param isBrowsing - Whether the model is browsing web
 * @returns Memoized loading status text
 */
export function useLoadingStatusText(
  isLoading: boolean,
  isThinking: boolean,
  isBrowsing: boolean,
) {
  return useMemo(() => {
    if (!isLoading) return null;

    if (isBrowsing) return "Searching...";
    if (isThinking) return "Thinking...";
    return "Generating...";
  }, [isLoading, isThinking, isBrowsing]);
}

/**
 * Custom hook that manages pending browsing state
 * @param isLoading - Whether chat is loading
 * @returns State setter for pending browsing
 */
export function usePendingBrowsingState(isLoading: boolean) {
  const [pendingBrowsing, setPendingBrowsing] = useState(false);

  // Reset pending browsing when loading stops
  useEffect(() => {
    if (!isLoading) {
      setPendingBrowsing(false);
    }
  }, [isLoading]);

  return [pendingBrowsing, setPendingBrowsing] as const;
}

/**
 * Custom hook that manages pending thinking state
 * @param isLoading - Whether chat is loading
 * @returns State setter for pending thinking
 */
export function usePendingThinkingState(isLoading: boolean) {
  const [pendingThinking, setPendingThinking] = useState(false);

  // Reset pending thinking when loading stops
  useEffect(() => {
    if (!isLoading) {
      setPendingThinking(false);
    }
  }, [isLoading]);

  return [pendingThinking, setPendingThinking] as const;
}
