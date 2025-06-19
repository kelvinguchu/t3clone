"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, MessageSquare, Paperclip, Key } from "lucide-react";
import { UpgradeSection } from "@/components/settings/account/upgrade";
import { DeleteAccountSection } from "@/components/settings/account/delete";

export default function AccountPage() {
  const { user } = useUser();

  // Convex operations
  const userDataSummary = useQuery(
    api.users.getUserDataSummary,
    user ? { userId: user.id } : "skip",
  );

  return (
    <div className="space-y-6">
      {/* Upgrade Section */}
      <UpgradeSection />

      {/* Data Summary */}
      {userDataSummary && userDataSummary.hasData && (
        <Card className="border-blue-200/60 dark:border-blue-800/50">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Your Data
            </CardTitle>
            <CardDescription>
              Overview of your data stored in our system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  {userDataSummary.threads}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Conversations
                </div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  {userDataSummary.messages}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Messages
                </div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Paperclip className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  {userDataSummary.attachments}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  Files
                </div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Key className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  {userDataSummary.apiKeys}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  API Keys
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Danger Zone */}
      <DeleteAccountSection userDataSummary={userDataSummary} />
    </div>
  );
}
