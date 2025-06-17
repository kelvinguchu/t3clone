import { useState, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface ThreadRenameParams {
  threadId: Id<"threads">;
  currentTitle: string;
  isAnonymous: boolean;
  sessionId?: string;
}

export interface ThreadRenameState {
  isEditing: boolean;
  tempTitle: string;
  isSubmitting: boolean;
  error: string | null;
}

export interface ThreadRenameActions {
  startEditing: () => void;
  cancelEditing: () => void;
  updateTempTitle: (title: string) => void;
  submitRename: () => Promise<void>;
}

export interface UseThreadRenameReturn {
  state: ThreadRenameState;
  actions: ThreadRenameActions;
}

/**
 * Custom hook for managing thread rename functionality
 * Handles optimistic updates, validation, and error states
 */
export function useThreadRename({
  threadId,
  currentTitle,
  isAnonymous,
  sessionId,
}: ThreadRenameParams): UseThreadRenameReturn {
  // Local state management
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(currentTitle);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convex mutation
  const updateThreadMutation = useMutation(api.threads.updateThread);

  // Actions
  const startEditing = useCallback(() => {
    setIsEditing(true);
    setTempTitle(currentTitle);
    setError(null);
  }, [currentTitle]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setTempTitle(currentTitle);
    setError(null);
  }, [currentTitle]);

  const updateTempTitle = useCallback(
    (title: string) => {
      setTempTitle(title);
      // Clear error when user starts typing
      if (error) setError(null);
    },
    [error],
  );

  const submitRename = useCallback(async () => {
    const trimmedTitle = tempTitle.trim();

    // Validation
    if (!trimmedTitle) {
      setError("Title cannot be empty");
      return;
    }

    if (trimmedTitle === currentTitle) {
      // No change, just exit editing mode
      setIsEditing(false);
      return;
    }

    if (trimmedTitle.length > 100) {
      setError("Title must be 100 characters or less");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateThreadMutation({
        threadId,
        title: trimmedTitle,
        ...(isAnonymous && sessionId ? { sessionId } : {}),
      });

      // Success - exit editing mode
      setIsEditing(false);
      setTempTitle(trimmedTitle);
    } catch (error) {
      console.error("[ThreadRename] Failed to rename thread:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to rename thread. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    tempTitle,
    currentTitle,
    threadId,
    isAnonymous,
    sessionId,
    updateThreadMutation,
  ]);

  // Reset temp title when current title changes (e.g., from optimistic updates)
  useEffect(() => {
    if (!isEditing) {
      setTempTitle(currentTitle);
    }
  }, [currentTitle, isEditing]);

  return {
    state: {
      isEditing,
      tempTitle,
      isSubmitting,
      error,
    },
    actions: {
      startEditing,
      cancelEditing,
      updateTempTitle,
      submitRename,
    },
  };
}
