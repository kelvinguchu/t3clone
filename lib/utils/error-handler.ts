import { toast } from "sonner";

export interface ErrorInfo {
  type:
    | "user_friendly"
    | "technical"
    | "retry_needed"
    | "rate_limit"
    | "token_limit"
    | "network"
    | "auth";
  title: string;
  message: string;
  action?: "retry" | "upgrade" | "wait" | "signin" | "reduce_message";
  retryable: boolean;
  showToast: boolean;
}

export interface ParsedError {
  info: ErrorInfo;
  originalError: Error;
}

// Parse different types of errors and categorize them
export function parseError(error: Error): ParsedError {
  const errorMessage = error.message.toLowerCase();
  const errorString = error.toString().toLowerCase();

  // Token limit exceeded errors
  if (
    errorMessage.includes("request too large") ||
    (errorMessage.includes("token") &&
      (errorMessage.includes("limit") || errorMessage.includes("exceeded")))
  ) {
    return {
      info: {
        type: "token_limit",
        title: "Message Too Long",
        message:
          "Your message is too long for the selected model. Please try a shorter message or switch to a model with a larger context window.",
        action: "reduce_message",
        retryable: true,
        showToast: true,
      },
      originalError: error,
    };
  }

  // Rate limit errors
  if (
    errorMessage.includes("rate limit") ||
    errorMessage.includes("too many requests") ||
    errorString.includes("429")
  ) {
    return {
      info: {
        type: "rate_limit",
        title: "Rate Limit Reached",
        message:
          "You're sending messages too quickly. Please wait a moment and try again.",
        action: "wait",
        retryable: true,
        showToast: true,
      },
      originalError: error,
    };
  }

  // Authentication errors
  if (
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("authentication") ||
    errorMessage.includes("invalid api key") ||
    errorString.includes("401")
  ) {
    return {
      info: {
        type: "auth",
        title: "Authentication Error",
        message:
          "There was an authentication issue. Please try signing in again.",
        action: "signin",
        retryable: false,
        showToast: true,
      },
      originalError: error,
    };
  }

  // Network/connection errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("fetch")
  ) {
    return {
      info: {
        type: "network",
        title: "Connection Issue",
        message:
          "Unable to connect to the server. Please check your internet connection and try again.",
        action: "retry",
        retryable: true,
        showToast: true,
      },
      originalError: error,
    };
  }

  // Model-specific errors
  if (errorMessage.includes("model") && errorMessage.includes("not found")) {
    return {
      info: {
        type: "user_friendly",
        title: "Model Unavailable",
        message:
          "The selected AI model is currently unavailable. Please try a different model.",
        retryable: true,
        showToast: true,
      },
      originalError: error,
    };
  }

  // Session/thread errors for anonymous users
  if (errorMessage.includes("session") || errorMessage.includes("thread")) {
    return {
      info: {
        type: "user_friendly",
        title: "Session Issue",
        message:
          "There was an issue with your session. Please refresh the page and try again.",
        action: "retry",
        retryable: true,
        showToast: true,
      },
      originalError: error,
    };
  }

  // Generic server errors
  if (
    errorString.includes("500") ||
    errorMessage.includes("internal server error")
  ) {
    return {
      info: {
        type: "retry_needed",
        title: "Server Error",
        message:
          "Something went wrong on our end. Please try again in a moment.",
        action: "retry",
        retryable: true,
        showToast: true,
      },
      originalError: error,
    };
  }

  // Default case for unknown errors
  return {
    info: {
      type: "technical",
      title: "Unexpected Error",
      message:
        "An unexpected error occurred. Please try again or contact support if the issue persists.",
      action: "retry",
      retryable: true,
      showToast: true,
    },
    originalError: error,
  };
}

// Display appropriate toast notification based on error type
export function showErrorToast(
  parsedError: ParsedError,
  onRetry?: () => void,
): void {
  const { info } = parsedError;

  if (!info.showToast) return;

  const toastOptions: Parameters<typeof toast.error>[1] = {
    duration: info.type === "rate_limit" ? 5000 : 4000,
  };

  // Add action button for retryable errors
  if (info.retryable && onRetry && info.action === "retry") {
    toastOptions.action = {
      label: "Retry",
      onClick: onRetry,
    };
  }

  // Add specific action buttons based on error type
  if (info.action === "upgrade") {
    toastOptions.action = {
      label: "Upgrade",
      onClick: () => {
        // Navigate to upgrade page or show upgrade modal
        window.open("/upgrade", "_blank");
      },
    };
  }

  if (info.action === "signin") {
    toastOptions.action = {
      label: "Sign In",
      onClick: () => {
        // Navigate to sign in page
        window.location.href = "/sign-in";
      },
    };
  }

  toast.error(info.message, toastOptions);
}

// Utility function to handle errors in chat context
export function handleChatError(
  error: Error,
  onRetry?: () => void,
): ParsedError {
  const parsedError = parseError(error);
  showErrorToast(parsedError, onRetry);
  return parsedError;
}

// Check if an error should trigger a retry
export function shouldAutoRetry(parsedError: ParsedError): boolean {
  return (
    parsedError.info.retryable &&
    (parsedError.info.type === "network" ||
      parsedError.info.type === "retry_needed")
  );
}

// Get user-friendly error message without showing toast
export function getErrorMessage(error: Error): string {
  const parsedError = parseError(error);
  return parsedError.info.message;
}
