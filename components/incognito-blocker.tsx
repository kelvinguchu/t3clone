"use client";

import { useIncognitoDetector } from "@/hooks/use-incognito-detector";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { ShieldAlert } from "lucide-react";

export function IncognitoBlocker() {
  const { isIncognito, isChecking } = useIncognitoDetector();

  // We only render the dialog, never allowing it to be closed.
  // This effectively blocks the app.
  const isOpen = isIncognito && !isChecking;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md bg-white/80 dark:bg-dark-bg/80 backdrop-blur-lg border-2 border-red-500 dark:border-red-700 shadow-2xl">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900/50 rounded-full w-fit">
            <ShieldAlert className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <AlertDialogTitle className="text-center text-2xl font-bold text-red-800 dark:text-red-200">
            Incognito Mode Not Supported
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-base text-red-700 dark:text-red-300 pt-2">
            This application cannot be used in private browsing or incognito
            mode. Please switch to a regular browser window to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
}
