import { useState, useCallback, useEffect } from "react";
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

// Manage thread sharing with URL generation, cloning controls, and view tracking
export function useThreadShare({
  threadId,
  isAnonymous,
  currentlyPublic = false,
  currentShareToken = null,
}: ThreadShareParams): UseThreadShareReturn {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(
    currentShareToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${currentShareToken}`
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(currentlyPublic);
  const [allowCloning, setAllowCloning] = useState(true);

  const threadStats = useQuery(
    api.threads.getThreadStats,
    isPublic ? { threadId } : "skip",
  );

  const toggleShareMutation = useMutation(api.threads.toggleThreadShare);

  // Update local state from thread stats
  useEffect(() => {
    if (threadStats) {
      setIsPublic(threadStats.isPublic);
      setAllowCloning(threadStats.allowCloning);
      if (threadStats.shareToken) {
        const baseUrl =
          typeof window !== "undefined" ? window.location.origin : "";
        setShareUrl(`${baseUrl}/share/${threadStats.shareToken}`);
      }
    }
  }, [threadStats]);

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

        const newIsPublic = !isPublic;
        setIsPublic(newIsPublic);

        if (options?.allowCloning !== undefined) {
          setAllowCloning(options.allowCloning);
        }

        if (newIsPublic && shareToken) {
          const baseUrl =
            typeof window !== "undefined" ? window.location.origin : "";
          const newShareUrl = `${baseUrl}/share/${shareToken}`;
          setShareUrl(newShareUrl);
        } else {
          setShareUrl(null);
        }
      } catch (error) {
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
          isPublic: true,
          allowCloning: newAllowCloning,
        });

        setAllowCloning(newAllowCloning);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to update cloning settings. Please try again.",
        );
      } finally {
        setIsSharing(false);
      }
    },
    [threadId, isAnonymous, isPublic, toggleShareMutation],
  );

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) {
      setError("No share URL available");
      return;
    }

    try {
      // Use modern clipboard API with fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
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
    } catch {
      setError("Failed to copy URL to clipboard");
    }
  }, [shareUrl]);

  const refreshStats = useCallback(() => {
    // Triggers refetch of threadStats query
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
