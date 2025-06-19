import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";

export interface ThreadDeleteParams {
  threadId: Id<"threads">;
  threadTitle: string;
  isAnonymous: boolean;
  sessionId?: string;
  currentThreadId?: string | null;
  onSuccess?: () => void;
}

export interface ThreadDeleteState {
  isConfirmOpen: boolean;
  isDeleting: boolean;
  error: string | null;
}

export interface ThreadDeleteActions {
  openConfirm: () => void;
  closeConfirm: () => void;
  confirmDelete: () => Promise<void>;
}

export interface UseThreadDeleteReturn {
  state: ThreadDeleteState;
  actions: ThreadDeleteActions;
}

// Manage thread deletion with confirmation and navigation handling
export function useThreadDelete({
  threadId,
  threadTitle,
  isAnonymous,
  sessionId,
  currentThreadId,
  onSuccess,
}: ThreadDeleteParams): UseThreadDeleteReturn {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const deleteThreadMutation = useMutation(api.threads.deleteThread);

  const openConfirm = useCallback(() => {
    setIsConfirmOpen(true);
    setError(null);
  }, []);

  const closeConfirm = useCallback(() => {
    setIsConfirmOpen(false);
    setError(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await deleteThreadMutation({
        threadId,
        ...(isAnonymous && sessionId ? { sessionId } : {}),
      });

      setIsConfirmOpen(false);

      // Redirect to chat home if deleting current thread
      if (currentThreadId === String(threadId)) {
        router.push("/chat");
      }

      onSuccess?.();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete thread. Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [
    threadId,
    threadTitle,
    isAnonymous,
    sessionId,
    currentThreadId,
    router,
    onSuccess,
    deleteThreadMutation,
  ]);

  return {
    state: {
      isConfirmOpen,
      isDeleting,
      error,
    },
    actions: {
      openConfirm,
      closeConfirm,
      confirmDelete,
    },
  };
}
