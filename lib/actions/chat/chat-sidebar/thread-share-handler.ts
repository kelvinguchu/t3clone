import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface ThreadShareParams {
  threadId: Id<"threads">;
  threadTitle: string;
  isAnonymous: boolean;
  currentlyPublic?: boolean;
  currentShareToken?: string | null;
}

export interface ThreadShareState {
  isDialogOpen: boolean;
  isSharing: boolean;
  shareUrl: string | null;
  error: string | null;
  isPublic: boolean;
  allowCloning: boolean;
  shareStats: {
    viewCount: number;
    cloneCount: number;
    lastViewed?: number;
  } | null;
  expiresAt: number | null;
}

export interface ThreadShareActions {
  openDialog: () => void;
  closeDialog: () => void;
  toggleShare: (options?: {
    expiresInHours?: number;
    allowCloning?: boolean;
  }) => Promise<void>;
  updateCloningSettings: (allowCloning: boolean) => Promise<void>;
  copyShareUrl: () => Promise<void>;
  refreshStats: () => void;
}

export interface UseThreadShareReturn {
  state: ThreadShareState;
  actions: ThreadShareActions;
}

/**
 * Enhanced custom hook for managing thread sharing functionality
 * Handles share URL generation, cloning controls, view tracking, and advanced sharing options
 */
export function useThreadShare({
  threadId,
  threadTitle,
  isAnonymous,
  currentlyPublic = false,
  currentShareToken = null,
}: ThreadShareParams): UseThreadShareReturn {
  // Local state management
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    currentShareToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${currentShareToken}`
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(currentlyPublic);
  const [allowCloning, setAllowCloning] = useState(true); // Default to allowing cloning

  // Fetch thread statistics when public
  const threadStats = useQuery(
    api.threads.getThreadStats,
    isPublic ? { threadId } : "skip",
  );

  // Convex mutations
  const toggleShareMutation = useMutation(api.threads.toggleThreadShare);

  // Sync state with thread stats when available
  useState(() => {
    if (threadStats) {
      setIsPublic(threadStats.isPublic);
      setAllowCloning(threadStats.allowCloning);
      if (threadStats.shareToken) {
        const baseUrl =
          typeof window !== "undefined" ? window.location.origin : "";
        setShareUrl(`${baseUrl}/share/${threadStats.shareToken}`);
      }
    }
  });

  // Actions
  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
    setError(null);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setError(null);
  }, []);

  const toggleShare = useCallback(
    async (options?: { expiresInHours?: number; allowCloning?: boolean }) => {
      // Anonymous users cannot share threads
      if (isAnonymous) {
        setError(
          "Anonymous users cannot share threads. Please sign up to share.",
        );
        return;
      }

      setIsSharing(true);
      setError(null);

      try {
        const shareToken = await toggleShareMutation({
          threadId,
          isPublic: !isPublic,
          allowCloning: options?.allowCloning ?? allowCloning,
          ...(options?.expiresInHours
            ? { expiresInHours: options.expiresInHours }
            : {}),
        });

        // Update local state
        const newIsPublic = !isPublic;
        setIsPublic(newIsPublic);

        if (options?.allowCloning !== undefined) {
          setAllowCloning(options.allowCloning);
        }

        if (newIsPublic && shareToken) {
          // Generate share URL
          const baseUrl =
            typeof window !== "undefined" ? window.location.origin : "";
          const newShareUrl = `${baseUrl}/share/${shareToken}`;
          setShareUrl(newShareUrl);
        } else {
          // Thread is now private
          setShareUrl(null);
        }

        console.log(
          `[ThreadShare] ${newIsPublic ? "Shared" : "Unshared"} thread: ${threadTitle}`,
          { allowCloning: options?.allowCloning ?? allowCloning },
        );
      } catch (error) {
        console.error("[ThreadShare] Failed to toggle share:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to share thread. Please try again.",
        );
      } finally {
        setIsSharing(false);
      }
    },
    [
      threadId,
      threadTitle,
      isAnonymous,
      isPublic,
      allowCloning,
      toggleShareMutation,
    ],
  );

  const updateCloningSettings = useCallback(
    async (newAllowCloning: boolean) => {
      if (isAnonymous) {
        setError("Anonymous users cannot modify sharing settings.");
        return;
      }

      if (!isPublic) {
        setError("Thread must be public to modify cloning settings.");
        return;
      }

      setIsSharing(true);
      setError(null);

      try {
        await toggleShareMutation({
          threadId,
          isPublic: true, // Keep it public, just update cloning
          allowCloning: newAllowCloning,
        });

        setAllowCloning(newAllowCloning);

        console.log(
          `[ThreadShare] Updated cloning settings for thread: ${threadTitle}`,
          { allowCloning: newAllowCloning },
        );
      } catch (error) {
        console.error(
          "[ThreadShare] Failed to update cloning settings:",
          error,
        );
        setError(
          error instanceof Error
            ? error.message
            : "Failed to update cloning settings. Please try again.",
        );
      } finally {
        setIsSharing(false);
      }
    },
    [threadId, threadTitle, isAnonymous, isPublic, toggleShareMutation],
  );

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) {
      setError("No share URL available");
      return;
    }

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      console.log("[ThreadShare] Share URL copied to clipboard");

      // Could show a toast notification here
      // For now, we'll rely on the UI to show feedback
    } catch (error) {
      console.error("[ThreadShare] Failed to copy share URL:", error);
      setError("Failed to copy URL to clipboard");
    }
  }, [shareUrl]);

  const refreshStats = useCallback(() => {
    // This will trigger a refetch of threadStats
    // The query will automatically update when called
  }, []);

  return {
    state: {
      isDialogOpen,
      isSharing,
      shareUrl,
      error,
      isPublic,
      allowCloning,
      shareStats: threadStats
        ? {
            viewCount: threadStats.viewCount,
            cloneCount: threadStats.cloneCount,
            lastViewed: threadStats.lastViewed,
          }
        : null,
      expiresAt: threadStats?.shareExpiresAt || null,
    },
    actions: {
      openDialog,
      closeDialog,
      toggleShare,
      updateCloningSettings,
      copyShareUrl,
      refreshStats,
    },
  };
}
