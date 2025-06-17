import { useCallback } from "react";

/**
 * Custom hook that creates a memoized function to load and cache conversation context
 * @param initialThreadId - The thread ID to load context for
 * @returns Memoized callback function to load conversation context
 */
export function useConversationContextLoader(initialThreadId: string | null) {
  return useCallback(async () => {
    if (!initialThreadId) return;

    try {
      // Check if we have cached context via API
      const response = await fetch(
        `/api/cache/messages?threadId=${initialThreadId}`,
      );
      if (response.ok) {
        const { data: cachedSummary } = await response.json();

        if (cachedSummary && cachedSummary.hasMessages) {
          // Found cached conversation context
        } else {
          // No cached context found, will be created as messages are sent
        }
      }
    } catch {
      // Failed to check conversation context
    }
  }, [initialThreadId]);
}
