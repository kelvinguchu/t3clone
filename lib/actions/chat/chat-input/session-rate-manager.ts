import { useMemo } from "react";

export interface SessionData {
  isAnonymous: boolean;
  canSendMessage: boolean;
  remainingMessages: number;
  messageCount: number;
}

export interface SessionRateManagerParams {
  sessionData?: SessionData;
  isLoaded: boolean;
  status?: string;
  isUploading: boolean;
  message: string;
  attachmentCount: number;
}

export interface SessionRateManagerReturn {
  // Session state
  isAnonymous: boolean;
  canSendMessage: boolean;
  remainingMessages: number;
  messageCount: number;

  // Rate limiting state
  isRateLimited: boolean;
  isDisabled: boolean;

  // Warning levels
  warningLevel: {
    color: "red" | "orange";
    level: "critical" | "warning";
  } | null;

  // Button states
  canSend: boolean;
  canStop: boolean;
  isStreaming: boolean;
}

/**
 * Custom hook that manages session state and rate limiting logic
 */
export function useSessionRateManager({
  sessionData,
  isLoaded,
  status = "ready",
  isUploading,
  message,
  attachmentCount,
}: SessionRateManagerParams): SessionRateManagerReturn {
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

  // Rate limiting logic
  const isRateLimited = isAnonymous && !canSendMessage;

  // Update disabled logic - no longer disable input during streaming
  const isDisabled = isRateLimited;

  // Determine button state based on AI SDK status
  const isStreaming = status === "streaming" || status === "submitted";
  const canSend =
    (Boolean(message.trim()) || attachmentCount > 0) &&
    !isDisabled &&
    !isUploading &&
    status === "ready";
  const canStop = isStreaming;

  // Get warning level - memoized to prevent re-renders
  const warningLevel = useMemo(() => {
    if (!isLoaded) return null;

    if (isAnonymous) {
      // Anonymous user warnings (10 message limit)
      const remaining = remainingMessages;
      const total = 10;

      if (remaining <= 2) {
        return { color: "red" as const, level: "critical" as const };
      }
      if (remaining <= Math.floor(total / 2)) {
        // 5 messages or less (half of 10)
        return { color: "orange" as const, level: "warning" as const };
      }
      return null;
    } else {
      // Authenticated user warnings (plan-based limits)
      const remaining = remainingMessages;
      const used = messageCount;
      const total = used + remaining;

      if (total <= 0) return null; // No limit or invalid data

      if (remaining <= 2) {
        return { color: "red" as const, level: "critical" as const };
      }
      if (remaining <= Math.floor(total / 2)) {
        // Half of plan limit (rounded down for consistent behavior)
        return { color: "orange" as const, level: "warning" as const };
      }
      return null;
    }
  }, [isAnonymous, isLoaded, messageCount, remainingMessages]);

  return {
    // Session state
    isAnonymous,
    canSendMessage,
    remainingMessages,
    messageCount,

    // Rate limiting state
    isRateLimited,
    isDisabled,

    // Warning levels
    warningLevel,

    // Button states
    canSend,
    canStop,
    isStreaming,
  };
}

/**
 * Utility function to check if user can perform an action
 */
export function canPerformAction(
  isAnonymous: boolean,
  canSendMessage: boolean,
  isLoading: boolean,
): boolean {
  if (isAnonymous && !canSendMessage) return false; // rate-limited
  if (isLoading) return false; // currently generating
  return true;
}

/**
 * Utility function to get rate limit warning message
 */
export function getRateLimitMessage(
  warningLevel: { level: string } | null,
  remainingMessages: number,
  isAnonymous: boolean = true,
): string {
  if (!warningLevel) return "";

  if (isAnonymous) {
    // Anonymous user messages
    switch (warningLevel.level) {
      case "critical":
        return `Only ${remainingMessages} messages left! Sign up for unlimited access.`;
      case "warning":
        return `${remainingMessages} messages remaining. Consider signing up.`;
      default:
        return "";
    }
  } else {
    // Authenticated user messages
    switch (warningLevel.level) {
      case "critical":
        return `Only ${remainingMessages} messages left in your plan!`;
      case "warning":
        return `${remainingMessages} messages remaining in your plan.`;
      default:
        return "";
    }
  }
}

/**
 * Utility function to get rate limit exceeded message
 */
export function getRateLimitExceededMessage(
  isAnonymous: boolean = true,
): string {
  if (isAnonymous) {
    return "Message limit reached! Sign up to continue chatting or wait 24 hours for reset.";
  } else {
    return "Plan limit reached! Upgrade your plan or wait for reset to continue chatting.";
  }
}

/**
 * Utility function to determine placeholder text based on state
 */
export function getPlaceholderText(
  isRateLimited: boolean,
  isStreaming: boolean,
  isUploading: boolean,
  defaultPlaceholder: string,
): string {
  if (isRateLimited) return "Message limit reached. Sign up to continue...";
  if (isStreaming) return "Generating...";
  if (isUploading) return "Uploading files...";
  return defaultPlaceholder;
}

/**
 * Utility function to get button title with context
 */
export function getButtonTitle(
  canSend: boolean,
  canStop: boolean,
  isSavingPartial: boolean,
): string {
  if (isSavingPartial) return "Saving partial response...";
  if (canStop) return "Stop generation and save partial response";
  if (canSend) return "Send message";
  return "Type a message to send";
}
