import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAvailableModels, getModelInfo } from "@/lib/ai-providers";
import { useModelStore } from "@/lib/stores/model-store";
import { GitBranch } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { useThreadsCache } from "@/lib/contexts/threads-cache-context";

export interface BranchingPopoverProps {
  messageId: string;
  threadId: string;
  sessionId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

/**
 * Branching Popover Component
 * Extracted from chat-messages.tsx
 */
export function BranchingPopover({
  messageId,
  threadId,
  sessionId,
  isOpen,
  onOpenChange,
  children,
}: BranchingPopoverProps) {
  const router = useRouter();
  const branchThread = useMutation(api.threads.branchThread);
  const { enabledModels, isReady } = useModelStore();
  const { invalidateCache } = useThreadsCache();

  // Filter available models by enabled models from store
  const allAvailableModels = getAvailableModels();
  const availableModels = allAvailableModels.filter((modelId) =>
    enabledModels.has(modelId),
  );

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children || (
          <button
            aria-label="Branch conversation"
            className="cursor-pointer hover:text-purple-700 dark:hover:text-slate-300 transition-colors p-1 sm:p-2 rounded-md hover:bg-purple-50 dark:hover:bg-dark-bg-tertiary/50"
          >
            <GitBranch className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-48 max-w-xs p-3 sm:p-4 space-y-2 sm:space-y-3 bg-purple-50 dark:bg-dark-bg-tertiary border border-purple-200 dark:border-dark-purple-accent shadow-lg backdrop-blur-sm">
        <p className="text-xs font-semibold text-purple-700 dark:text-slate-300 uppercase tracking-wide select-none">
          Choose model to branch with
        </p>
        <div className="space-y-1 sm:space-y-1.5">
          {!isReady() ? (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">
                Loading models...
              </span>
            </div>
          ) : (
            availableModels.map((mId) => {
              const info = getModelInfo(mId);
              return (
                <button
                  key={mId}
                  /*
                   * NOTE: We use `onPointerDown` instead of `onClick` here.
                   * On some mobile browsers (particularly iOS Safari) Radix
                   * closes the Popover on `pointerdown` which prevents the
                   * subsequent `click` event from firing. By handling the
                   * action in `pointerdown` *and* stopping propagation we
                   * ensure the handler always runs before the popover unmounts.
                   */
                  onPointerDown={async (e) => {
                    // Prevent the popover from treating this as an outside click
                    e.stopPropagation();

                    if (!threadId || !messageId) return;

                    try {
                      // Call the branchThread mutation
                      const newThreadId = await branchThread({
                        sourceThreadId: threadId as Id<"threads">,
                        branchFromMessageId: messageId as Id<"messages">,
                        model: mId,
                        ...(sessionId ? { sessionId } : {}),
                      });

                      // Navigate to the new branched thread
                      router.push(`/chat/${newThreadId}`);

                      // Invalidate the cache to show the new thread immediately
                      invalidateCache();

                      // Close the popover
                      onOpenChange(false);
                    } catch (error) {
                      console.error("Failed to branch thread:", error);
                      // Could add toast notification here
                    }
                  }}
                  className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg hover:bg-purple-100 dark:hover:bg-dark-bg-secondary text-xs sm:text-sm text-left transition-all duration-200 border border-transparent hover:border-purple-200 dark:hover:border-dark-purple-accent group cursor-pointer whitespace-nowrap"
                >
                  <img
                    src={info.icon}
                    alt={info.name}
                    className="h-4 w-4 sm:h-5 sm:w-5 rounded-sm flex-shrink-0"
                  />
                  <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-purple-700 dark:group-hover:text-slate-200 transition-colors">
                    {info.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
