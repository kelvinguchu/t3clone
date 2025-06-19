import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ThreadCreatorReturn } from "./thread-creator";

export interface NewChatHandlerParams {
  user: { id: string } | null | undefined;
  threadCreator: ThreadCreatorReturn;
  onNewThread: () => void;
}

/**
 * Custom hook that creates a handler for new chat creation
 * Extracted from chat-sidebar.tsx
 */
export function useNewChatHandler({
  user,
  threadCreator,
  onNewThread,
}: NewChatHandlerParams) {
  const router = useRouter();
  const { createThread, createAnonymousThread } = threadCreator;

  return useCallback(async () => {
    // For anonymous users, the check now happens within useInfiniteThreads
    // and the canSendMessage prop on the chat input, so we can simplify here.
    if (!user && !threadCreator.isAnonymousSession) return;

    try {
      let threadId;

      if (user) {
        // Authenticated user
        threadId = await createThread({
          title: "New Chat",
          model: "gemini-2.0-flash",
        });
      } else {
        // Anonymous user - rely on the session from threadCreator
        threadId = await createAnonymousThread({
          title: "New Chat",
          model: "gemini-2.0-flash",
        });
      }

      // Navigate to the new thread
      if (threadId) {
        router.push(`/chat/${threadId}`);
        // Call the callback to trigger cache invalidation
        onNewThread();
      }
    } catch {
      // Failed to create new chat
    }
  }, [
    user,
    threadCreator,
    createThread,
    createAnonymousThread,
    router,
    onNewThread,
  ]);
}
