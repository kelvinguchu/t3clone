import { Globe, Brain } from "lucide-react";

export interface CompactLoadingIndicatorProps {
  text: string | null;
}

/**
 * Compact Loading Indicator Component
 * Extracted from chat-messages.tsx
 */
export function CompactLoadingIndicator({
  text,
}: CompactLoadingIndicatorProps) {
  const isBrowsing = text?.startsWith("Searching") || text === "Browsing...";
  const isThinking = text === "Thinking...";
  const isDefault = !text; // When text is null, show default animated dots

  if (isDefault) {
    // Default loading state - just animated dots
    return (
      <div className="flex justify-start mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border shadow-sm max-w-fit bg-gray-50 dark:bg-dark-bg-tertiary/50 border-gray-200 dark:border-dark-purple-accent/50">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="h-1.5 w-1.5 bg-gray-500 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border shadow-sm max-w-fit ${
          isBrowsing
            ? "bg-emerald-50 dark:bg-dark-bg-tertiary/50 border-emerald-200 dark:border-emerald-500/50"
            : isThinking
              ? "bg-amber-50 dark:bg-dark-bg-tertiary/50 border-amber-200 dark:border-amber-500/50"
              : "bg-purple-50 dark:bg-dark-bg-tertiary/50 border-purple-200 dark:border-dark-purple-accent/50"
        }`}
      >
        {isBrowsing ? (
          <>
            <Globe className="h-3 w-3 text-emerald-600 animate-spin" />
            <span className="text-emerald-700 dark:text-emerald-300">
              {text}
            </span>
          </>
        ) : isThinking ? (
          <>
            <Brain className="h-3 w-3 text-amber-600 animate-pulse" />
            <span className="text-amber-700 dark:text-amber-300">{text}</span>
          </>
        ) : (
          <>
            <div className="h-3 w-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-purple-700 dark:text-purple-300">{text}</span>
          </>
        )}
      </div>
    </div>
  );
}
