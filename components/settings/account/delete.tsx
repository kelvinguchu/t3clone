"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface DeleteAccountSectionProps {
  userDataSummary?: {
    threads: number;
    messages: number;
    attachments: number;
    apiKeys: number;
    hasData: boolean;
  };
}

export function DeleteAccountSection({
  userDataSummary,
}: DeleteAccountSectionProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  // Convex operations
  const deleteAllUserData = useMutation(api.users.deleteAllUserData);

  const handleDeleteAccount = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      // First delete all user data from Convex
      await deleteAllUserData({ userId: user.id });

      // Then delete the Clerk user account
      await user.delete();

      // Sign out and redirect
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Failed to delete account:", error);
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-red-200/60 dark:border-red-800/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <CardTitle className="text-red-900 dark:text-red-100">
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <h4 className="font-medium text-red-900 dark:text-red-100">
                Delete Account
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300">
                Permanently delete your account and all associated data. This
                action cannot be undone and will immediately:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 ml-4">
                <li>• Delete all your conversations and messages</li>
                <li>• Remove all uploaded files and attachments</li>
                <li>• Clear your usage history and settings</li>
                <li>• Revoke all stored API keys</li>
                <li>• Cancel any active subscriptions</li>
              </ul>
              <div className="pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isDeleting}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isDeleting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Deleting...
                        </div>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Account
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        Delete Account
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          This action is <strong>irreversible</strong>. Your
                          account and all data will be permanently deleted.
                        </p>
                        {userDataSummary?.hasData && (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 mt-3">
                            <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                              The following data will be deleted:
                            </p>
                            <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                              <li>
                                • {userDataSummary.threads} conversation
                                {userDataSummary.threads !== 1 ? "s" : ""}
                              </li>
                              <li>
                                • {userDataSummary.messages} message
                                {userDataSummary.messages !== 1 ? "s" : ""}
                              </li>
                              <li>
                                • {userDataSummary.attachments} file
                                {userDataSummary.attachments !== 1 ? "s" : ""}
                              </li>
                              <li>
                                • {userDataSummary.apiKeys} API key
                                {userDataSummary.apiKeys !== 1 ? "s" : ""}
                              </li>
                            </ul>
                          </div>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Deleting...
                          </div>
                        ) : (
                          "Yes, Delete My Account"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
