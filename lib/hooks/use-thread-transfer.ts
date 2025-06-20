import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";

async function requestSessionMerge(fromSessionId: string, toSessionId: string) {
  try {
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "merge",
        fromSessionId,
        toSessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Session merge failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("[requestSessionMerge] API call failed:", error);
    throw error;
  }
}

// Background thread transfer hook - handles session mismatches silently
export function useBackgroundThreadTransfer() {
  const { sessionData } = useAnonymousSession();
  const autoTransferMutation = useMutation(
    api.threads.autoTransferAnonymousThread,
  );

  const transferThreadSilently = useCallback(
    async (threadId: Id<"threads">) => {
      if (!sessionData?.sessionId) return false;

      try {
        const result = await autoTransferMutation({
          threadId,
          newSessionId: sessionData.sessionId,
        });

        // If the thread was transferred, request a server-side merge of the sessions.
        if (result.success && result.oldSessionId && sessionData.sessionId) {
          const oldSessionId = result.oldSessionId;
          const newSessionId = sessionData.sessionId;

          // Request the server to merge the sessions in the background.
          Promise.resolve().then(async () => {
            try {
              await requestSessionMerge(oldSessionId, newSessionId);
            } catch (error) {
              console.error(
                "[BackgroundTransfer] Session merge failed:",
                error,
              );
            }
          });
        }

        return result.success;
      } catch (error) {
        console.error("[BackgroundTransfer] Transfer mutation failed:", error);
        return false;
      }
    },
    [sessionData?.sessionId, autoTransferMutation],
  );

  return {
    transferThreadSilently,
  };
}

// Hook to auto-transfer threads when accessing them
export function useAutoTransferOnAccess() {
  const { transferThreadSilently } = useBackgroundThreadTransfer();

  const ensureThreadAccess = useCallback(
    async (threadId: Id<"threads">) => {
      // Always attempt silent transfer in background
      // This is safe to call even if transfer isn't needed
      await transferThreadSilently(threadId);
    },
    [transferThreadSilently],
  );

  return {
    ensureThreadAccess,
  };
}
