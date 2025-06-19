"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Clock, X } from "lucide-react";

export interface WarningLevel {
  color: "red" | "orange";
  level: "critical" | "warning";
}

export interface RateLimitWarningsProps {
  // Mounting and session state
  isMounted: boolean;
  isAnonymous: boolean;
  isLoaded: boolean;

  // Warning state
  warningLevel: WarningLevel | null;
  remainingMessages: number;

  // Rate limit state
  isRateLimited: boolean;
  canSendMessage: boolean;
}

/**
 * Rate limiting warning components extracted from original chat-input.tsx lines 607-670
 * Shows progressive warnings and rate limit exceeded messages for anonymous users
 */
export function RateLimitWarnings({
  isMounted,
  isAnonymous,
  isLoaded,
  warningLevel,
  remainingMessages,
  isRateLimited,
  canSendMessage,
}: Readonly<RateLimitWarningsProps>) {
  const [dismissedWarning, setDismissedWarning] = useState<string | null>(null);

  // Create a unique key for the current warning to track dismissals
  const warningKey = warningLevel
    ? `${warningLevel.level}-${remainingMessages}-${isAnonymous ? "anon" : "auth"}`
    : null;

  // Don't show warning if it's been dismissed
  const shouldShowWarning = warningLevel && warningKey !== dismissedWarning;

  return (
    <>
      {/* Rate Limiting Warning for All Users - updated from lines 608-649 */}
      {isMounted &&
        isLoaded &&
        shouldShowWarning &&
        warningLevel &&
        warningLevel.color &&
        warningLevel.level &&
        typeof remainingMessages === "number" &&
        remainingMessages >= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mx-auto w-full sm:w-[95%] md:w-[90%] px-3 sm:px-4 py-2 border-x-2 ${
              warningLevel.color === "red"
                ? "bg-red-50/90 dark:bg-dark-bg-tertiary/80 border-red-300 dark:border-red-500/50"
                : "bg-orange-50/90 dark:bg-dark-bg-tertiary/80 border-orange-300 dark:border-orange-500/50"
            }`}
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <AlertTriangle
                className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${
                  warningLevel.color === "red"
                    ? "text-red-600 dark:text-red-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              />
              <span
                className={`font-medium flex-1 ${
                  warningLevel.color === "red"
                    ? "text-red-800 dark:text-red-200"
                    : "text-orange-800 dark:text-orange-200"
                }`}
              >
                {isAnonymous
                  ? // Anonymous user messages
                    warningLevel.level === "critical"
                    ? `Only ${remainingMessages} messages left! Sign up for unlimited access.`
                    : `${remainingMessages} messages remaining. Consider signing up.`
                  : // Authenticated user messages
                    warningLevel.level === "critical"
                    ? `Only ${remainingMessages} messages left in your plan!`
                    : `${remainingMessages} messages remaining in your plan.`}
              </span>
              <button
                onClick={() => setDismissedWarning(warningKey)}
                className={`p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
                  warningLevel.color === "red"
                    ? "text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                    : "text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200"
                }`}
                aria-label="Dismiss warning"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
            </div>
          </motion.div>
        )}

      {/* Rate Limit Exceeded Warning - updated from lines 651-669 */}
      {isMounted && isLoaded && isRateLimited && !canSendMessage && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full sm:w-[95%] md:w-[90%] px-3 sm:px-4 py-3 border-x-2 bg-red-50/90 dark:bg-dark-bg-tertiary/80 border-red-300 dark:border-red-500/50"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="font-medium text-red-800 dark:text-red-200">
              {isAnonymous
                ? "Message limit reached! Sign up to continue chatting or wait 24 hours for reset."
                : "Plan limit reached! Upgrade your plan or wait for reset to continue chatting."}
            </span>
          </div>
        </motion.div>
      )}
    </>
  );
}

/**
 * Utility function to get background color classes for warning level
 */
export function getWarningBackgroundClasses(color: "red" | "orange"): string {
  switch (color) {
    case "red":
      return "bg-red-50/90 dark:bg-dark-bg-tertiary/80 border-red-300 dark:border-red-500/50";
    case "orange":
      return "bg-orange-50/90 dark:bg-dark-bg-tertiary/80 border-orange-300 dark:border-orange-500/50";
    default:
      return "bg-orange-50/90 dark:bg-dark-bg-tertiary/80 border-orange-300 dark:border-orange-500/50";
  }
}

/**
 * Utility function to get icon color classes for warning level
 */
export function getWarningIconClasses(color: "red" | "orange"): string {
  switch (color) {
    case "red":
      return "text-red-600 dark:text-red-400";
    case "orange":
      return "text-orange-600 dark:text-orange-400";
    default:
      return "text-orange-600 dark:text-orange-400";
  }
}

/**
 * Utility function to get text color classes for warning level
 */
export function getWarningTextClasses(color: "red" | "orange"): string {
  switch (color) {
    case "red":
      return "text-red-800 dark:text-red-200";
    case "orange":
      return "text-orange-800 dark:text-orange-200";
    default:
      return "text-orange-800 dark:text-orange-200";
  }
}

/**
 * Utility function to get warning message text
 */
export function getWarningMessage(
  level: "critical" | "warning",
  remainingMessages: number,
  isAnonymous: boolean = true,
): string {
  if (isAnonymous) {
    // Anonymous user messages
    switch (level) {
      case "critical":
        return `Only ${remainingMessages} messages left! Sign up for unlimited access.`;
      case "warning":
        return `${remainingMessages} messages remaining. Consider signing up.`;
      default:
        return `${remainingMessages} messages remaining. Consider signing up.`;
    }
  } else {
    // Authenticated user messages
    switch (level) {
      case "critical":
        return `Only ${remainingMessages} messages left in your plan!`;
      case "warning":
        return `${remainingMessages} messages remaining in your plan.`;
      default:
        return `${remainingMessages} messages remaining in your plan.`;
    }
  }
}
