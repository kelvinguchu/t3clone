"use client";

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ErrorDisplayProps {
  error: Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryable?: boolean;
  className?: string;
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  retryable = true,
  className,
}: ErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  if (!error) return null;

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  // Determine error type and styling
  const isTokenError =
    error.message.toLowerCase().includes("token") ||
    error.message.toLowerCase().includes("too large");
  const isRateLimit = error.message.toLowerCase().includes("rate limit");
  const isNetworkError =
    error.message.toLowerCase().includes("network") ||
    error.message.toLowerCase().includes("connection");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={className}
      >
        <Alert variant="destructive" className="relative">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="pr-8">
            <div className="flex flex-col gap-2">
              <p className="font-medium">
                {isTokenError && "Message Too Long"}
                {isRateLimit && "Rate Limit Reached"}
                {isNetworkError && "Connection Issue"}
                {!isTokenError && !isRateLimit && !isNetworkError && "Error"}
              </p>
              <p className="text-sm opacity-90">
                {isTokenError &&
                  "Your message is too long for the selected model. Please try a shorter message or switch to a model with a larger context window."}
                {isRateLimit &&
                  "You're sending messages too quickly. Please wait a moment and try again."}
                {isNetworkError &&
                  "Unable to connect to the server. Please check your internet connection and try again."}
                {!isTokenError &&
                  !isRateLimit &&
                  !isNetworkError &&
                  error.message}
              </p>
              {retryable && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="h-7 px-3 text-xs bg-background/50 hover:bg-background/80"
                  >
                    {isRetrying ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Retry
                      </>
                    )}
                  </Button>
                  {isTokenError && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Could trigger a model switch or message editing
                        console.log("Switch model or edit message");
                      }}
                      className="h-7 px-3 text-xs bg-background/50 hover:bg-background/80"
                    >
                      Switch Model
                    </Button>
                  )}
                </div>
              )}
            </div>
          </AlertDescription>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="absolute top-2 right-2 p-1 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss error"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Alert>
      </motion.div>
    </AnimatePresence>
  );
}