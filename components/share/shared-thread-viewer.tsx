"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Share2,
  Copy,
  Eye,
  Clock,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { ChatMessages } from "@/components/chat/chat-area/chat-messages";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";

interface Props {
  shareToken: string;
}

export function SharedThreadViewer({ shareToken }: Props) {
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const { redirectToSignIn } = useClerk();

  // Get the shared thread
  const sharedThread = useQuery(api.threads.getSharedThreadWithTracking, {
    shareToken,
    viewerId: userId || undefined,
  });

  // Get messages for the shared thread
  const messages = useQuery(
    api.messages.getThreadMessagesWithAttachments,
    sharedThread
      ? {
          threadId: sharedThread._id,
        }
      : "skip",
  );

  // Track view mutation
  const trackView = useMutation(api.threads.trackShareView);

  // Track the view once when component mounts
  useEffect(() => {
    if (sharedThread && !hasTrackedView) {
      trackView({
        shareToken,
        viewerId: userId || undefined,
      }).catch(console.error);
      setHasTrackedView(true);
    }
  }, [sharedThread, hasTrackedView, shareToken, userId, trackView]);

  const handleCloneClick = () => {
    if (isSignedIn) {
      // Redirect to clone handler
      router.push(`/auth/callback/share?token=${shareToken}&action=clone`);
    } else {
      // Use Clerk's proper redirect method with afterSignInUrl
      redirectToSignIn({
        afterSignInUrl: `/auth/callback/share?token=${shareToken}&action=clone`,
      });
    }
  };

  const handleShareClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      // You could add a toast notification here
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  // Convert Convex messages to DisplayMessage format
  const displayMessages =
    messages?.map((msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      id: msg._id,
      model: msg.model,
      toolsUsed: msg.toolsUsed,
      hasToolCalls: msg.hasToolCalls,
      reasoning: msg.reasoning,
      attachments: msg.attachments,
    })) || [];

  // Loading state
  if (sharedThread === undefined || messages === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white dark:bg-dark-bg">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white/70 dark:bg-dark-bg-secondary/70 rounded-lg p-6 border border-purple-200 dark:border-dark-purple-accent backdrop-blur-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-purple-200 dark:bg-dark-bg rounded w-3/4"></div>
              <div className="h-4 bg-purple-100 dark:bg-gray-800 rounded w-1/2"></div>
              <div className="space-y-3 mt-6">
                <div className="h-4 bg-purple-100 dark:bg-gray-800 rounded"></div>
                <div className="h-4 bg-purple-100 dark:bg-gray-800 rounded w-5/6"></div>
                <div className="h-4 bg-purple-100 dark:bg-gray-800 rounded w-4/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state - thread not found or expired
  if (sharedThread === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white dark:bg-dark-bg flex items-center justify-center px-4">
        <div className="max-w-md mx-auto text-center space-y-4">
          <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              This shared conversation is no longer available. It may have been
              made private, deleted, or expired.
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="cursor-pointer border-purple-300 dark:border-dark-purple-accent text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-dark-bg"
          >
            Go to T3 Chat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white dark:bg-dark-bg">
      {/* Compact Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-dark-bg-secondary/80 backdrop-blur-md border-b border-purple-200 dark:border-dark-purple-accent">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: App branding */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-600 rounded-lg">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-purple-800 dark:text-purple-200 text-base sm:text-lg">
                  T3 Chat
                </h1>
              </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                onClick={handleShareClick}
                variant="outline"
                size="sm"
                className="cursor-pointer border-purple-300 dark:border-dark-purple-accent text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-dark-bg px-2 sm:px-3"
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden md:inline ml-1">Share</span>
              </Button>

              {sharedThread.allowCloning && (
                <Button
                  onClick={handleCloneClick}
                  size="sm"
                  className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white px-2 sm:px-3"
                >
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">
                    {isSignedIn ? "Clone" : "Sign in"}
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Thread Info Card */}
        <div className="bg-white/70 dark:bg-dark-bg-secondary/70 rounded-lg p-4 mb-6 border border-purple-200 dark:border-dark-purple-accent backdrop-blur-sm">
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-purple-800 dark:text-purple-200 line-clamp-2">
              {sharedThread.title}
            </h2>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1 text-purple-600 dark:text-purple-300">
                <Clock className="h-3 w-3" />
                {new Date(sharedThread.createdAt).toLocaleDateString()}
              </div>
              {sharedThread.shareMetadata?.viewCount && (
                <div className="flex items-center gap-1 text-purple-600 dark:text-purple-300">
                  <Eye className="h-3 w-3" />
                  {sharedThread.shareMetadata.viewCount} views
                </div>
              )}
              <Badge
                variant="secondary"
                className="bg-purple-100 dark:bg-dark-bg text-purple-700 dark:text-purple-300 border-purple-300 dark:border-dark-purple-accent"
              >
                {sharedThread.model}
              </Badge>
              {sharedThread.allowCloning && (
                <Badge
                  variant="outline"
                  className="border-green-300 dark:border-green-600 text-green-700 dark:text-green-300"
                >
                  Cloning Enabled
                </Badge>
              )}
            </div>

            {/* Expiration warning */}
            {sharedThread.shareExpiresAt && (
              <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                  This conversation expires on{" "}
                  {new Date(sharedThread.shareExpiresAt).toLocaleDateString()}
                </AlertDescription>
              </Alert>
            )}

            {/* Clone prompt for unauthenticated users */}
            {!isSignedIn && sharedThread.allowCloning && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:bg-gradient-to-r dark:from-dark-bg-secondary dark:to-dark-bg-secondary border border-blue-200 dark:border-dark-purple-accent rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-purple-300">
                    <Copy className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium">
                      Continue this conversation
                    </span>
                  </div>
                  <Button
                    onClick={handleCloneClick}
                    size="sm"
                    className="cursor-pointer bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white w-full sm:w-auto"
                  >
                    <Copy className="h-3 w-3 mr-1 sm:hidden" />
                    Sign in to Clone
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white/50 dark:bg-dark-bg-secondary/50 rounded-lg border border-purple-200 dark:border-dark-purple-accent backdrop-blur-sm">
          <ChatMessages
            messages={displayMessages}
            isLoading={false}
            threadId={sharedThread._id}
            showActionButtons={{ copy: true, retry: false, branch: false }}
          />
        </div>
      </div>
    </div>
  );
}
