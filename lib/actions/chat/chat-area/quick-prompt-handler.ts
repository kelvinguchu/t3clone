import { useCallback } from "react";

/**
 * Custom hook that creates a handler for quick prompt selection
 * @param isAnonymous - Whether user is anonymous
 * @param canSendMessage - Whether user can send messages (rate limit check)
 * @param isLoading - Whether chat is currently loading/generating
 * @param setPrefillMessage - Function to set prefilled message
 * @returns Memoized callback function to handle quick prompts
 */
export function useQuickPromptHandler(
  isAnonymous: boolean,
  canSendMessage: boolean,
  isLoading: boolean,
  setPrefillMessage: (message: string | null) => void,
) {
  return useCallback(
    (prompt: string) => {
      if (isAnonymous && !canSendMessage) return; // rate-limited
      if (isLoading) return; // currently generating

      setPrefillMessage(prompt);
    },
    [isAnonymous, canSendMessage, isLoading, setPrefillMessage],
  );
}
