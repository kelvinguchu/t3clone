"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import type { UseThreadRenameReturn } from "@/lib/actions/chat/chat-sidebar/thread-rename-handler";

export interface ThreadRenameInputProps {
  rename: UseThreadRenameReturn;
  className?: string;
}

export function ThreadRenameInput({
  rename,
  className = "",
}: Readonly<ThreadRenameInputProps>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const { state, actions } = rename;
  const { isEditing, tempTitle, isSubmitting, error } = state;
  const { cancelEditing, updateTempTitle, submitRename } = actions;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasUserInteracted(true);
    updateTempTitle(e.target.value);
  };

  // Handle blur (lose focus)
  const handleBlur = () => {
    // Only auto-submit if user has made changes
    if (hasUserInteracted) {
      submitRename();
    } else {
      cancelEditing();
    }
  };

  if (!isEditing) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="flex-1 relative">
        <Input
          ref={inputRef}
          value={tempTitle}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSubmitting}
          className={`h-8 text-sm bg-white dark:bg-dark-bg-tertiary border-purple-300 dark:border-dark-purple-accent focus:border-purple-500 dark:focus:border-dark-purple-glow ${
            error
              ? "border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400"
              : ""
          }`}
          placeholder="Enter thread title..."
          maxLength={100}
        />
        {error && (
          <div className="absolute top-full left-0 mt-1 text-xs text-red-600 dark:text-red-400 bg-white dark:bg-dark-bg-secondary px-2 py-1 rounded shadow-sm border border-red-200 dark:border-red-500/50 z-10 whitespace-nowrap">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
          onClick={submitRename}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          <span className="sr-only">Save</span>
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-dark-bg-secondary"
          onClick={cancelEditing}
          disabled={isSubmitting}
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Cancel</span>
        </Button>
      </div>
    </div>
  );
}
