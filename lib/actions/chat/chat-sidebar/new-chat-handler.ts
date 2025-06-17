import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Doc } from "@/convex/_generated/dataModel";
import type { ThreadCreatorReturn } from "./thread-creator";

export interface NewChatHandlerParams {
  user: { id: string } | null | undefined;
  sessionId: string | null;
  sessionData: { ipHash?: string } | null;
  threadsData: Doc<"threads">[];
  threadCreator: ThreadCreatorReturn;
}

/**
 * Custom hook that creates a handler for new chat creation
 * Extracted from chat-sidebar.tsx
 */
export function useNewChatHandler({
  user,
  sessionId,
  sessionData,
  threadsData,
  threadCreator,
}: NewChatHandlerParams) {
  const router = useRouter();
  const { createThread, createAnonymousThread } = threadCreator;

  return useCallback(async () => {
    if (!user && !sessionId) return;

    try {
      let threadId;

      if (user) {
        // Authenticated user
        threadId = await createThread({
          title: "New Chat",
          model: "gemini-2.0-flash",
        });
      } else {
        // Anonymous user
        if ((threadsData?.length || 0) >= 5) {
          alert(
            "You've reached the conversation limit. Please sign in for unlimited chats.",
          );
          return;
        }

        threadId = await createAnonymousThread({
          sessionId: sessionId!,
          ipHash: sessionData?.ipHash ?? "unknown",
          title: "New Chat",
          model: "gemini-2.0-flash",
        });
      }

      // Navigate to the new thread
      if (threadId) {
        router.push(`/chat/${threadId}`);
      }
    } catch {
      // Failed to create new chat
    }
  }, [
    user,
    sessionId,
    sessionData,
    threadsData,
    createThread,
    createAnonymousThread,
    router,
  ]);
}
