import { useEffect, useCallback } from "react";

export interface AttachmentPreview {
  id: string;
  name: string;
  contentType: string;
  url: string;
  size: number;
}

export interface DraftPersistenceParams {
  currentThreadKey: string;
  message: string;
  setMessage: (message: string) => void;
  attachmentPreviews: AttachmentPreview[];
  setAttachmentIds: React.Dispatch<React.SetStateAction<string[]>>;
  presetMessage?: string | null;
  autoResize: () => void;
  addFilePreview: (attachment: AttachmentPreview) => void;
}

/**
 * Custom hook that manages draft persistence utilities for localStorage operations
 */
export function useDraftPersistenceUtils() {
  // localStorage utilities for draft messages
  const getDraftMessage = useCallback((key: string): string => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(`chat-draft-${key}`) || "";
    } catch {
      return "";
    }
  }, []);

  const saveDraftMessage = useCallback((key: string, message: string) => {
    if (typeof window === "undefined") return;
    try {
      if (message.trim()) {
        localStorage.setItem(`chat-draft-${key}`, message);
      } else {
        localStorage.removeItem(`chat-draft-${key}`);
      }
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  const clearDraftMessage = useCallback((key: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`chat-draft-${key}`);
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  // localStorage utilities for file attachments
  const getDraftAttachments = useCallback(
    (key: string): AttachmentPreview[] => {
      if (typeof window === "undefined") return [];
      try {
        const saved = localStorage.getItem(`chat-attachments-${key}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    },
    [],
  );

  const saveDraftAttachments = useCallback(
    (key: string, attachments: AttachmentPreview[]) => {
      if (typeof window === "undefined") return;
      try {
        if (attachments.length > 0) {
          localStorage.setItem(
            `chat-attachments-${key}`,
            JSON.stringify(attachments),
          );
        } else {
          localStorage.removeItem(`chat-attachments-${key}`);
        }
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    [],
  );

  const clearDraftAttachments = useCallback((key: string) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(`chat-attachments-${key}`);
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  return {
    // Message persistence
    getDraftMessage,
    saveDraftMessage,
    clearDraftMessage,
    // Attachment persistence
    getDraftAttachments,
    saveDraftAttachments,
    clearDraftAttachments,
  };
}

/**
 * Custom hook that manages loading draft content when thread changes
 */
export function useDraftLoader({
  currentThreadKey,
  setMessage,
  setAttachmentIds,
  presetMessage,
  autoResize,
  addFilePreview,
}: Pick<
  DraftPersistenceParams,
  | "currentThreadKey"
  | "setMessage"
  | "setAttachmentIds"
  | "presetMessage"
  | "autoResize"
  | "addFilePreview"
>) {
  const { getDraftMessage, getDraftAttachments } = useDraftPersistenceUtils();

  // Load draft message and attachments when thread changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const draftMessage = getDraftMessage(currentThreadKey);
      const draftAttachments = getDraftAttachments(currentThreadKey);

      // Only set draft if there's no preset message
      if (!presetMessage) {
        setMessage(draftMessage);
        // Auto-resize after setting draft message
        setTimeout(autoResize, 0);
      }

      // Restore draft attachments
      if (draftAttachments.length > 0) {
        // Add each attachment to file preview context
        draftAttachments.forEach((attachment) => {
          addFilePreview(attachment);
        });
        // Set attachment IDs
        setAttachmentIds(draftAttachments.map((att) => att.id));
      }
    }
  }, [
    currentThreadKey,
    getDraftMessage,
    getDraftAttachments,
    autoResize,
    presetMessage,
    addFilePreview,
    setMessage,
    setAttachmentIds,
  ]);
}

/**
 * Custom hook that manages auto-saving draft messages with debouncing
 */
export function useDraftMessageSaver({
  message,
  currentThreadKey,
  presetMessage,
}: Pick<
  DraftPersistenceParams,
  "message" | "currentThreadKey" | "presetMessage"
>) {
  const { saveDraftMessage } = useDraftPersistenceUtils();

  // Save draft message whenever message changes (debounced)
  useEffect(() => {
    // Don't save preset messages as drafts
    if (presetMessage && message === presetMessage) return;

    const timeoutId = setTimeout(() => {
      saveDraftMessage(currentThreadKey, message);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [message, currentThreadKey, saveDraftMessage, presetMessage]);
}

/**
 * Custom hook that manages auto-saving draft attachments with debouncing
 */
export function useDraftAttachmentSaver({
  attachmentPreviews,
  currentThreadKey,
}: Pick<DraftPersistenceParams, "attachmentPreviews" | "currentThreadKey">) {
  const { saveDraftAttachments } = useDraftPersistenceUtils();

  // Save draft attachments whenever attachments change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveDraftAttachments(currentThreadKey, attachmentPreviews);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [attachmentPreviews, currentThreadKey, saveDraftAttachments]);
}

/**
 * Main hook that combines all draft persistence functionality
 */
export function useDraftPersistence(params: DraftPersistenceParams) {
  const utils = useDraftPersistenceUtils();

  // Load drafts when thread changes
  useDraftLoader({
    currentThreadKey: params.currentThreadKey,
    setMessage: params.setMessage,
    setAttachmentIds: params.setAttachmentIds,
    presetMessage: params.presetMessage,
    autoResize: params.autoResize,
    addFilePreview: params.addFilePreview,
  });

  // Auto-save message drafts
  useDraftMessageSaver({
    message: params.message,
    currentThreadKey: params.currentThreadKey,
    presetMessage: params.presetMessage,
  });

  // Auto-save attachment drafts
  useDraftAttachmentSaver({
    attachmentPreviews: params.attachmentPreviews,
    currentThreadKey: params.currentThreadKey,
  });

  return utils;
}
