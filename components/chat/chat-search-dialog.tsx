"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, GitBranch } from "lucide-react";
import {
  useThreadsFetcher,
  useThreadGrouping,
  getThreadTime,
} from "@/lib/actions/chat/chat-sidebar";
import type { Doc } from "@/convex/_generated/dataModel";

export interface ChatSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSearchDialog({
  open,
  onOpenChange,
}: Readonly<ChatSearchDialogProps>) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // Use the same extracted utilities as the sidebar
  const { threadsData, threadsLoading } = useThreadsFetcher();

  // Filter threads based on search and time period
  const filteredThreadsData = searchQuery
    ? threadsData // When searching, show all threads
    : threadsData.filter((thread) => {
        const threadTime = getThreadTime(thread);
        const now = new Date();
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000,
        );
        return threadTime >= thirtyDaysAgo.getTime();
      });

  const groupedThreads = useThreadGrouping(filteredThreadsData, searchQuery);

  // Handle thread navigation
  const handleThreadClick = (threadId: string) => {
    router.push(`/chat/${threadId}`);
    onOpenChange(false); // Close dialog after navigation
  };

  // Clear search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  const renderThreadItem = (thread: Doc<"threads">) => {
    const cleanTitle =
      thread.title
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/\n+/g, " ") || "New Chat";

    return (
      <button
        key={thread._id}
        onClick={() => handleThreadClick(String(thread._id))}
        className="w-full text-left p-3 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/50 transition-all duration-200 border border-transparent hover:border-purple-200 dark:hover:border-purple-700 group"
      >
        <div className="flex items-center gap-3">
          {thread.parentThreadId && (
            <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-purple-900 dark:text-purple-100 truncate group-hover:text-purple-700 dark:group-hover:text-purple-300">
              {cleanTitle}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const renderThreadGroup = (
    title: string,
    threads: Doc<"threads">[],
    count: number,
  ) => {
    if (threads.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 px-1">
          <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
            {title}
          </h3>
          <Badge
            variant="secondary"
            className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs"
          >
            {count}
          </Badge>
        </div>
        <div className="space-y-1">{threads.map(renderThreadItem)}</div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-purple-50/95 dark:bg-purple-950/95 border-purple-200 dark:border-purple-700">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            Search Conversations
          </DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/50 focus:border-purple-400 focus:ring-purple-400/20"
            autoFocus
          />
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 max-h-[50vh]">
          {threadsLoading ? (
            // Loading state
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="h-4 w-4 bg-purple-200 dark:bg-purple-800 rounded animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-purple-200 dark:bg-purple-800 rounded animate-pulse" />
                    <div className="h-3 bg-purple-100 dark:bg-purple-900 rounded animate-pulse w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Today */}
              {renderThreadGroup(
                "Today",
                groupedThreads.today,
                groupedThreads.today.length,
              )}

              {/* Yesterday */}
              {renderThreadGroup(
                "Yesterday",
                groupedThreads.yesterday,
                groupedThreads.yesterday.length,
              )}

              {/* Last 7 Days */}
              {renderThreadGroup(
                "Last 7 days",
                groupedThreads.last7Days,
                groupedThreads.last7Days.length,
              )}

              {/* Last 30 Days */}
              {renderThreadGroup(
                "Last 30 days",
                groupedThreads.last30Days,
                groupedThreads.last30Days.length,
              )}

              {/* Earlier */}
              {renderThreadGroup(
                "Earlier",
                groupedThreads.earlier,
                groupedThreads.earlier.length,
              )}

              {/* Empty states */}
              {groupedThreads.today.length === 0 &&
                groupedThreads.yesterday.length === 0 &&
                groupedThreads.last7Days.length === 0 &&
                groupedThreads.last30Days.length === 0 &&
                groupedThreads.earlier.length === 0 &&
                searchQuery && (
                  <div className="text-center py-8">
                    <Search className="h-12 w-12 text-purple-300 mx-auto mb-3" />
                    <p className="text-purple-600 dark:text-purple-400 font-medium">
                      No conversations found
                    </p>
                    <p className="text-purple-500/70 text-sm">
                      Try a different search term
                    </p>
                  </div>
                )}

              {groupedThreads.today.length === 0 &&
                groupedThreads.yesterday.length === 0 &&
                groupedThreads.last7Days.length === 0 &&
                groupedThreads.last30Days.length === 0 &&
                groupedThreads.earlier.length === 0 &&
                !searchQuery && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-purple-300 mx-auto mb-3" />
                    <p className="text-purple-600 dark:text-purple-400 font-medium">
                      No conversations yet
                    </p>
                    <p className="text-purple-500/70 text-sm">
                      Start your first conversation above
                    </p>
                  </div>
                )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
