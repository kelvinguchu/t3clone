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

/**
 * Custom hook for managing thread deletion with confirmation
 * Handles navigation redirect if deleting current thread
 */
export function useThreadDelete({
  threadId,
  threadTitle,
  isAnonymous,
  sessionId,
  currentThreadId,
  onSuccess,
}: ThreadDeleteParams): UseThreadDeleteReturn {
  // Local state management
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Router for navigation
  const router = useRouter();

  // Convex mutation
  const deleteThreadMutation = useMutation(api.threads.deleteThread);

  // Actions
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

      // Success - close confirmation dialog
      setIsConfirmOpen(false);

      // If we're deleting the currently active thread, redirect to chat home
      if (currentThreadId === String(threadId)) {
        router.push("/chat");
      }

      // Call success callback if provided
      onSuccess?.();

      console.log(`[ThreadDelete] Successfully deleted thread: ${threadTitle}`);
    } catch (error) {
      console.error("[ThreadDelete] Failed to delete thread:", error);
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
