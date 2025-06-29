"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, Copy } from "lucide-react";

// Module-level cache to track in-flight clone requests across component remounts
const inFlightCloneRequests = new Map<string, Promise<string>>();

interface Props {
  token: string;
  action: string;
  userId: string;
}

export function AuthCallbackHandler({ token, action, userId }: Props) {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [clonedThreadId, setClonedThreadId] = useState<string>("");
  const [hasProcessed, setHasProcessed] = useState(false);
  const [isExistingClone, setIsExistingClone] = useState(false);
  const router = useRouter();

  // Get the shared thread to validate and display info
  const sharedThread = useQuery(api.threads.getSharedThreadWithTracking, {
    shareToken: token,
    viewerId: userId,
  });

  // Check if user has already cloned this thread
  const existingCloneId = useQuery(api.threads.checkExistingClone, {
    shareToken: token,
  });

  // Clone mutation
  const cloneThread = useMutation(api.threads.cloneSharedThread);

  const handleCloneAction = useCallback(async () => {
    // Prevent multiple executions
    if (hasProcessed) {
      return;
    }

    // Check local storage cache first for immediate feedback
    const cacheKey = `clone_${token}_${userId}`;
    const cachedCloneId = localStorage.getItem(cacheKey);
    if (cachedCloneId) {
      setClonedThreadId(cachedCloneId);
      setIsExistingClone(true);
      setStatus("success");
      setHasProcessed(true);
      return;
    }

    // Use module-level cache to handle Strict Mode remounts
    if (inFlightCloneRequests.has(token)) {
      try {
        const threadId = await inFlightCloneRequests.get(token)!;
        setClonedThreadId(threadId);
        setIsExistingClone(true); // Treat as existing since we reused the request
        setStatus("success");
        setHasProcessed(true);
        localStorage.setItem(cacheKey, threadId);
        return;
      } catch {
        // If the in-flight request failed, we'll proceed with a new attempt
        inFlightCloneRequests.delete(token);
      }
    }

    if (!sharedThread) {
      setStatus("error");
      setErrorMessage("Shared thread not found or no longer available");
      setHasProcessed(true);
      return;
    }

    if (!sharedThread.allowCloning) {
      setStatus("error");
      setErrorMessage("Cloning is not allowed for this conversation");
      setHasProcessed(true);
      return;
    }

    // Check if user already has a clone
    if (existingCloneId) {
      setClonedThreadId(existingCloneId);
      setIsExistingClone(true);
      setStatus("success");
      setHasProcessed(true);
      // Cache the result
      localStorage.setItem(cacheKey, existingCloneId);
      return;
    }

    try {
      setStatus("loading");
      setHasProcessed(true);

      // Generate idempotency key for this specific clone request
      const idempotencyKey = `${userId}_${token}_${Date.now()}`;

      // Create and store the clone request promise to prevent duplicate requests
      const clonePromise = cloneThread({
        shareToken: token,
        newTitle: `${sharedThread.title} (Copy)`,
        idempotencyKey,
      });
      inFlightCloneRequests.set(token, clonePromise);

      // Wait for the clone to complete
      const threadId = await clonePromise;

      // Clean up the in-flight request
      inFlightCloneRequests.delete(token);

      setClonedThreadId(threadId);
      setIsExistingClone(false);
      setStatus("success");

      // Cache the successful result
      localStorage.setItem(cacheKey, threadId);
    } catch (error) {
      // Clean up the in-flight request on error
      inFlightCloneRequests.delete(token);

      setStatus("error");
      // Handle different types of errors
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An unexpected error occurred while cloning");
      }
      console.error("Clone error:", error);
    }
  }, [sharedThread, hasProcessed, existingCloneId, cloneThread, token, userId]);

  useEffect(() => {
    if (action === "clone" && sharedThread && userId && !hasProcessed) {
      handleCloneAction();
    }
  }, [action, sharedThread, userId, hasProcessed, handleCloneAction]);

  const handleViewClonedThread = () => {
    if (clonedThreadId) {
      router.push(`/chat/${clonedThreadId}`);
    }
  };

  const handleBackToOriginal = () => {
    router.push(`/share/${token}`);
  };

  if (status === "loading") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="border-purple-200 dark:border-dark-purple-accent bg-white/80 dark:bg-dark-bg-secondary backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-3 bg-purple-100 dark:bg-dark-bg rounded-full w-fit">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-300" />
            </div>
            <CardTitle className="text-xl font-bold text-purple-800 dark:text-purple-200">
              {action === "clone"
                ? "Cloning Conversation"
                : "Processing Request"}
            </CardTitle>
            <CardDescription className="text-purple-600 dark:text-purple-300">
              {action === "clone"
                ? "Creating your personal copy of this conversation..."
                : "Please wait while we process your request..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-purple-400 dark:bg-purple-300 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-purple-400 dark:bg-purple-300 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-purple-400 dark:bg-purple-300 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="border-red-200 dark:border-red-700 bg-white/80 dark:bg-dark-bg-secondary backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900/50 rounded-full w-fit">
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl font-bold text-red-800 dark:text-red-200">
              Something Went Wrong
            </CardTitle>
            <CardDescription className="text-red-600 dark:text-red-400">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Button
              onClick={handleBackToOriginal}
              variant="outline"
              className="w-full cursor-pointer border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              Back to Original
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="secondary"
              className="w-full cursor-pointer bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success" && action === "clone") {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="border-green-200 dark:border-green-700 bg-white/80 dark:bg-dark-bg-secondary backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="mx-auto mb-4 p-3 bg-green-100 dark:bg-green-900/50 rounded-full w-fit">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl font-bold text-green-800 dark:text-green-200 mb-2">
              {isExistingClone
                ? "Already Cloned! ✨"
                : "Successfully Cloned! 🎉"}
            </CardTitle>
            <CardDescription className="text-green-600 dark:text-green-400 text-base">
              {isExistingClone
                ? "You already have a copy of this conversation in your chat history"
                : "The conversation is now available in your personal chat history"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <Button
              onClick={handleViewClonedThread}
              className="w-full cursor-pointer bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2.5"
            >
              <Copy className="h-4 w-4 mr-2" />
              Open Your Copy
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleBackToOriginal}
                variant="outline"
                size="sm"
                className="cursor-pointer border-purple-300 dark:border-dark-purple-accent text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-dark-bg"
              >
                View Original
              </Button>
              <Button
                onClick={() => router.push("/")}
                variant="outline"
                size="sm"
                className="cursor-pointer border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg"
              >
                Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback for unknown actions
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Unknown Action</CardTitle>
        <CardDescription>The requested action is not supported</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => router.push("/")} className="w-full">
          Go to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
