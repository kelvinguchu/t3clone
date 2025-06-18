"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import type { UseThreadDeleteReturn } from "@/lib/actions/chat/chat-sidebar/thread-delete-handler";

export interface ThreadDeleteDialogProps {
  delete: UseThreadDeleteReturn;
  threadTitle: string;
}

export function ThreadDeleteDialog({
  delete: deleteHook,
  threadTitle,
}: Readonly<ThreadDeleteDialogProps>) {
  const { state, actions } = deleteHook;
  const { isConfirmOpen, isDeleting, error } = state;
  const { closeConfirm, confirmDelete } = actions;

  return (
    <AlertDialog open={isConfirmOpen} onOpenChange={closeConfirm}>
      <AlertDialogContent className="bg-white dark:bg-dark-bg-secondary border border-purple-200 dark:border-dark-purple-accent">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-purple-900 dark:text-slate-200">
            Delete Thread
          </AlertDialogTitle>
          <AlertDialogDescription className="text-purple-700 dark:text-slate-400">
            Are you sure you want to delete{" "}
            <span className="font-medium">&quot;{threadTitle}&quot;</span>?
            <br />
            <br />
            This action cannot be undone. All messages in this thread will be
            permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-dark-bg-tertiary/50 border border-red-200 dark:border-red-500/50 rounded text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isDeleting}
            className="border-purple-300 dark:border-dark-purple-accent text-purple-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-dark-bg-tertiary/50"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 dark:bg-red-700 dark:hover:bg-red-800 dark:border-red-700 dark:hover:border-red-800"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Thread"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
