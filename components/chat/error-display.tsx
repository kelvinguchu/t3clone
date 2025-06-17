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
    <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto z-40">
      <div className="mx-auto w-full sm:w-[95%] md:w-[90%] lg:w-[80%] p-2 sm:p-2 md:p-3">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={className}
          >
            <Alert
              variant="destructive"
              className="relative bg-red-50/90 dark:bg-dark-bg-tertiary/90 border-2 border-red-200 dark:border-red-500/50 rounded-xl shadow-lg backdrop-blur-sm"
            >
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="pr-8">
                <div className="flex flex-col gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-red-800 dark:text-red-200">
                      {isTokenError && "Message Too Long"}
                      {isRateLimit && "Rate Limit Reached"}
                      {isNetworkError && "Connection Issue"}
                      {!isTokenError &&
                        !isRateLimit &&
                        !isNetworkError &&
                        "Error Occurred"}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
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
                  </div>

                  {retryable && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="h-8 px-3 text-xs bg-white/80 dark:bg-dark-bg-secondary/80 hover:bg-white dark:hover:bg-dark-bg-secondary border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 transition-all duration-200"
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
                          className="h-8 px-3 text-xs bg-white/80 dark:bg-dark-bg-secondary/80 hover:bg-white dark:hover:bg-dark-bg-secondary border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 transition-all duration-200"
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
                  className="absolute top-3 right-3 p-1 rounded-md opacity-70 hover:opacity-100 transition-all duration-200 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                  aria-label="Dismiss error"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </Alert>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
