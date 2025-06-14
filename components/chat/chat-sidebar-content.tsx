"use client";

import { startTransition, useState } from "react";
import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  MessageSquare,
  GitBranch,
  MoreVertical,
  PenSquare,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import type { ReactNode } from "react";

export type GroupedThreads = {
  today: Doc<"threads">[];
  yesterday: Doc<"threads">[];
  older: Doc<"threads">[];
};

export type ChatSidebarContentProps = {
  threadsLoading: boolean;
  groupedThreads: GroupedThreads;
  currentThreadId: string | null;
  searchQuery: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
};

export function ChatSidebarContent({
  threadsLoading,
  groupedThreads,
  currentThreadId,
  searchQuery,
  user,
}: Readonly<ChatSidebarContentProps>) {
  const router = useRouter();
  const [hoveredThread, setHoveredThread] = useState<string | null>(null);

  // Prefetch thread route on hover for better performance
  const handleThreadHover = (threadId: string) => {
    // Don't prefetch if we're already on this thread
    if (currentThreadId === threadId) return;

    startTransition(() => {
      router.prefetch(`/chat/${threadId}`);
    });
  };

  // Helper: resolve the best time to show (updatedAt fallback to _creationTime)
  const getThreadTime = (t: Doc<"threads">) =>
    typeof t.updatedAt === "number"
      ? t.updatedAt
      : (t as { _creationTime: number })._creationTime;

  // Format timestamps for grouping headings with precise day calculation
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();

    // Reset time to start of day for accurate day comparison
    const dateStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffInMs = nowStart.getTime() - dateStart.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30)
      return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const renderThreadItem = (thread: Doc<"threads">): ReactNode => {
    const isActive = currentThreadId === String(thread._id);
    const isHovered = hoveredThread === String(thread._id);
    const cleanTitle =
      thread.title
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/\n+/g, " ") || "New Chat";

    const threadUrl = `/chat/${thread._id}`;

    return (
      <SidebarMenuItem
        key={thread._id}
        className="relative overflow-visible"
        onMouseEnter={() => setHoveredThread(String(thread._id))}
        onMouseLeave={() => setHoveredThread(null)}
      >
        <Link href={threadUrl} prefetch={true}>
          <SidebarMenuButton
            isActive={isActive}
            className={`w-full justify-start text-left p-2 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer relative ${
              isActive
                ? "bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 border-l-4 border-purple-600 dark:border-purple-400"
                : "hover:bg-purple-50 dark:hover:bg-purple-900/50"
            }`}
            onMouseEnter={() => handleThreadHover(String(thread._id))}
          >
            <div className="flex items-center gap-3 w-full min-w-0">
              {thread.parentThreadId && (
                <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium text-sm truncate ${
                    isActive
                      ? "text-purple-900 dark:text-purple-100 font-semibold"
                      : "text-purple-700 dark:text-purple-400"
                  }`}
                >
                  {cleanTitle}
                </div>
              </div>
            </div>
          </SidebarMenuButton>
        </Link>

        {/* Overlay action button positioned absolutely on the right */}
        <div
          className={`absolute right-1 top-1/2 -translate-y-1/2 transition-opacity duration-200 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
          style={{ zIndex: 50 }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 bg-purple-600 hover:bg-purple-700 text-white rounded-md cursor-pointer shadow-sm border border-purple-300 dark:border-purple-700"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
                <span className="sr-only">Thread actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <PenSquare className="h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <ExternalLink className="h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive cursor-pointer">
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarContent className="px-4">
      <ScrollArea className="flex-1">
        {threadsLoading ? (
          // Show loading while data loads
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
          <div className="space-y-6">
            {/* Today */}
            {groupedThreads.today.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    Today
                  </h2>
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs"
                  >
                    {groupedThreads.today.length}
                  </Badge>
                </div>
                <SidebarMenu>
                  {groupedThreads.today.map(renderThreadItem)}
                </SidebarMenu>
              </div>
            )}

            {/* Yesterday */}
            {groupedThreads.yesterday.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    Yesterday
                  </h2>
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs"
                  >
                    {groupedThreads.yesterday.length}
                  </Badge>
                </div>
                <SidebarMenu>
                  {groupedThreads.yesterday.map(renderThreadItem)}
                </SidebarMenu>
              </div>
            )}

            {/* Older */}
            {groupedThreads.older.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                    Previous
                  </h2>
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-xs"
                  >
                    {groupedThreads.older.length}
                  </Badge>
                </div>
                <SidebarMenu>
                  {groupedThreads.older.map((thread) => {
                    const isActive = currentThreadId === String(thread._id);
                    const olderCleanTitle =
                      thread.title
                        .replace(/```[\s\S]*?```/g, "")
                        .replace(/`([^`]*)`/g, "$1")
                        .replace(/\n+/g, " ") || "New Chat";

                    const threadUrl = `/chat/${thread._id}`;

                    return (
                      <SidebarMenuItem
                        key={thread._id}
                        className="relative overflow-visible"
                        onMouseEnter={() =>
                          setHoveredThread(String(thread._id))
                        }
                        onMouseLeave={() => setHoveredThread(null)}
                      >
                        <Link href={threadUrl} prefetch={true}>
                          <SidebarMenuButton
                            isActive={isActive}
                            className={`w-full justify-start text-left p-2 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer relative ${
                              isActive
                                ? "bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 border-l-4 border-purple-600 dark:border-purple-400"
                                : "hover:bg-purple-50 dark:hover:bg-purple-900/50"
                            }`}
                            onMouseEnter={() =>
                              handleThreadHover(String(thread._id))
                            }
                          >
                            <div className="flex items-center gap-3 w-full min-w-0">
                              {thread.parentThreadId && (
                                <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`font-medium text-sm truncate ${
                                    isActive
                                      ? "text-purple-900 dark:text-purple-100 font-semibold"
                                      : "text-purple-700 dark:text-purple-400"
                                  }`}
                                >
                                  {olderCleanTitle}
                                </div>
                                <div
                                  className={`text-xs truncate ${
                                    isActive
                                      ? "text-purple-700 dark:text-purple-300"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {formatTimestamp(getThreadTime(thread))}
                                </div>
                              </div>
                            </div>
                          </SidebarMenuButton>
                        </Link>

                        {/* Overlay action button positioned absolutely on the right */}
                        <div
                          className={`absolute right-1 top-1/2 -translate-y-1/2 transition-opacity duration-200 ${
                            hoveredThread === String(thread._id)
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                          style={{ zIndex: 50 }}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 bg-purple-600 hover:bg-purple-700 text-white rounded-md cursor-pointer shadow-sm border border-purple-300 dark:border-purple-700"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3 w-3" />
                                <span className="sr-only">Thread actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem className="gap-2 cursor-pointer">
                                <PenSquare className="h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2 cursor-pointer">
                                <ExternalLink className="h-4 w-4" />
                                Share
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="gap-2 text-destructive cursor-pointer">
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            )}

            {groupedThreads.today.length === 0 &&
              groupedThreads.yesterday.length === 0 &&
              groupedThreads.older.length === 0 &&
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

            {/* Show empty state when no threads */}
            {groupedThreads.today.length === 0 &&
              groupedThreads.yesterday.length === 0 &&
              groupedThreads.older.length === 0 &&
              !searchQuery && (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-purple-300 mx-auto mb-3" />
                  <p className="text-purple-600 dark:text-purple-400 font-medium">
                    Start your first conversation
                  </p>
                  {user && (
                    <p className="text-purple-500/70 text-sm">
                      Your chats will be saved here
                    </p>
                  )}
                </div>
              )}
          </div>
        )}
      </ScrollArea>
    </SidebarContent>
  );
}
