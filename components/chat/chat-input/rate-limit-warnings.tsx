"use client";

import { motion } from "motion/react";
import { AlertTriangle, Clock } from "lucide-react";

export interface WarningLevel {
  color: "red" | "orange" | "yellow";
  level: "critical" | "warning" | "caution";
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
  return (
    <>
      {/* Rate Limiting Warning for Anonymous Users - extracted from lines 608-649 */}
      {isMounted &&
        isAnonymous &&
        isLoaded &&
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
                : warningLevel.color === "orange"
                  ? "bg-orange-50/90 dark:bg-dark-bg-tertiary/80 border-orange-300 dark:border-orange-500/50"
                  : "bg-yellow-50/90 dark:bg-dark-bg-tertiary/80 border-yellow-300 dark:border-yellow-500/50"
            }`}
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <AlertTriangle
                className={`h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 ${
                  warningLevel.color === "red"
                    ? "text-red-600 dark:text-red-400"
                    : warningLevel.color === "orange"
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-yellow-600 dark:text-yellow-400"
                }`}
              />
              <span
                className={`font-medium ${
                  warningLevel.color === "red"
                    ? "text-red-800 dark:text-red-200"
                    : warningLevel.color === "orange"
                      ? "text-orange-800 dark:text-orange-200"
                      : "text-yellow-800 dark:text-yellow-200"
                }`}
              >
                {warningLevel.level === "critical"
                  ? `Only ${remainingMessages} messages left! Sign up for unlimited access.`
                  : warningLevel.level === "warning"
                    ? `${remainingMessages} messages remaining. Consider signing up.`
                    : `${remainingMessages} of 10 messages remaining.`}
              </span>
            </div>
          </motion.div>
        )}

      {/* Rate Limit Exceeded Warning - extracted from lines 651-669 */}
      {isMounted &&
        isAnonymous &&
        isLoaded &&
        isRateLimited &&
        !canSendMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full sm:w-[95%] md:w-[90%] px-3 sm:px-4 py-3 border-x-2 bg-red-50/90 dark:bg-dark-bg-tertiary/80 border-red-300 dark:border-red-500/50"
          >
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="font-medium text-red-800 dark:text-red-200">
                Message limit reached! Sign up to continue chatting or wait 24
                hours for reset.
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
export function getWarningBackgroundClasses(
  color: "red" | "orange" | "yellow",
): string {
  switch (color) {
    case "red":
      return "bg-red-50/90 dark:bg-dark-bg-tertiary/80 border-red-300 dark:border-red-500/50";
    case "orange":
      return "bg-orange-50/90 dark:bg-dark-bg-tertiary/80 border-orange-300 dark:border-orange-500/50";
    case "yellow":
      return "bg-yellow-50/90 dark:bg-dark-bg-tertiary/80 border-yellow-300 dark:border-yellow-500/50";
    default:
      return "bg-yellow-50/90 dark:bg-dark-bg-tertiary/80 border-yellow-300 dark:border-yellow-500/50";
  }
}

/**
 * Utility function to get icon color classes for warning level
 */
export function getWarningIconClasses(
  color: "red" | "orange" | "yellow",
): string {
  switch (color) {
    case "red":
      return "text-red-600 dark:text-red-400";
    case "orange":
      return "text-orange-600 dark:text-orange-400";
    case "yellow":
      return "text-yellow-600 dark:text-yellow-400";
    default:
      return "text-yellow-600 dark:text-yellow-400";
  }
}

/**
 * Utility function to get text color classes for warning level
 */
export function getWarningTextClasses(
  color: "red" | "orange" | "yellow",
): string {
  switch (color) {
    case "red":
      return "text-red-800 dark:text-red-200";
    case "orange":
      return "text-orange-800 dark:text-orange-200";
    case "yellow":
      return "text-yellow-800 dark:text-yellow-200";
    default:
      return "text-yellow-800 dark:text-yellow-200";
  }
}

/**
 * Utility function to get warning message text
 */
export function getWarningMessage(
  level: "critical" | "warning" | "caution",
  remainingMessages: number,
): string {
  switch (level) {
    case "critical":
      return `Only ${remainingMessages} messages left! Sign up for unlimited access.`;
    case "warning":
      return `${remainingMessages} messages remaining. Consider signing up.`;
    case "caution":
      return `${remainingMessages} of 10 messages remaining.`;
    default:
      return `${remainingMessages} of 10 messages remaining.`;
  }
}
