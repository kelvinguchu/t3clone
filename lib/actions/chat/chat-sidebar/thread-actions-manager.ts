import type { Id } from "@/convex/_generated/dataModel";
import {
  useThreadRename,
  type ThreadRenameParams,
} from "./thread-rename-handler";
import {
  useThreadDelete,
  type ThreadDeleteParams,
} from "./thread-delete-handler";
import { useThreadShare, type ThreadShareParams } from "./thread-share-handler";

export interface ThreadActionsParams {
  threadId: Id<"threads">;
  threadTitle: string;
  isAnonymous: boolean;
  sessionId?: string;
  currentThreadId?: string | null;
  currentlyPublic?: boolean;
  onDeleteSuccess?: () => void;
}

export interface ThreadActionsReturn {
  rename: ReturnType<typeof useThreadRename>;
  delete: ReturnType<typeof useThreadDelete>;
  share: ReturnType<typeof useThreadShare>;
}

/**
 * Combined hook that manages all thread actions
 * Provides a single interface for rename, delete, and share functionality
 */
export function useThreadActions({
  threadId,
  threadTitle,
  isAnonymous,
  sessionId,
  currentThreadId,
  currentlyPublic,
  onDeleteSuccess,
}: ThreadActionsParams): ThreadActionsReturn {
  // Thread rename functionality
  const rename = useThreadRename({
    threadId,
    currentTitle: threadTitle,
    isAnonymous,
    sessionId,
  });

  // Thread delete functionality
  const deleteActions = useThreadDelete({
    threadId,
    threadTitle,
    isAnonymous,
    sessionId,
    currentThreadId,
    onSuccess: onDeleteSuccess,
  });

  // Thread share functionality
  const share = useThreadShare({
    threadId,
    threadTitle,
    isAnonymous,
    currentlyPublic,
  });

  return {
    rename,
    delete: deleteActions,
    share,
  };
}

// Helper types for individual action parameters
export type { ThreadRenameParams, ThreadDeleteParams, ThreadShareParams };
