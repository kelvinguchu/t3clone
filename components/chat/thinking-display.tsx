"use client";

import { useState, useEffect } from "react";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";

interface ThinkingDisplayProps {
  reasoning: string;
  isStreaming?: boolean;
  forceExpanded?: boolean;
  forceCollapsed?: boolean;
}

export function ThinkingDisplay({
  reasoning,
  isStreaming = false,
  forceExpanded = false,
  forceCollapsed = false,
}: Readonly<ThinkingDisplayProps>) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle forced states
  const effectiveExpanded = forceExpanded
    ? true
    : forceCollapsed
      ? false
      : isExpanded;

  // Auto-expand when thinking starts (forceExpanded) and auto-collapse when responding starts (forceCollapsed)
  useEffect(() => {
    if (forceExpanded) {
      setIsExpanded(true);
    } else if (forceCollapsed) {
      setIsExpanded(false);
    }
  }, [forceExpanded, forceCollapsed]);

  if (!reasoning || (reasoning.trim().length === 0 && !isStreaming)) {
    // During thinking phase, show even if no reasoning content yet
    if (forceExpanded) {
      return (
        <div className="mb-3 border border-blue-200 dark:border-blue-700 rounded-lg overflow-hidden bg-blue-50/50 dark:bg-blue-950/20">
          {/* Header */}
          <button
            onClick={() => setIsExpanded(!effectiveExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Thinking Process
                {isStreaming && (
                  <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                )}
              </span>
            </div>
            {effectiveExpanded ? (
              <ChevronUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            )}
          </button>

          {/* Content */}
          {effectiveExpanded && (
            <div className="px-3 pb-3 border-t border-blue-200 dark:border-blue-700">
              <div className="mt-3 text-sm text-blue-800 dark:text-blue-200 bg-white/50 dark:bg-gray-900/50 rounded p-3 font-mono whitespace-pre-wrap">
                <div className="text-blue-600 dark:text-blue-400 italic">
                  Thinking...
                  <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="mb-3 border border-blue-200 dark:border-blue-700 rounded-lg overflow-hidden bg-blue-50/50 dark:bg-blue-950/20">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!effectiveExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Thinking Process
            {isStreaming && (
              <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </span>
        </div>
        {effectiveExpanded ? (
          <ChevronUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {/* Content */}
      {effectiveExpanded && (
        <div className="px-3 pb-3 border-t border-blue-200 dark:border-blue-700">
          <div className="mt-3 text-sm text-blue-800 dark:text-blue-200 bg-white/50 dark:bg-gray-900/50 rounded p-3 font-mono whitespace-pre-wrap">
            <Markdown content={reasoning} isThinking={true} />
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
