"use client";

import { startTransition } from "react";
import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  GitBranch,
  MoreVertical,
  PenSquare,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Doc } from "@/convex/_generated/dataModel";
import { useThreadActions } from "@/lib/actions/chat/chat-sidebar";
import { ThreadRenameInput } from "./thread-rename-input";
import { ThreadDeleteDialog } from "./thread-delete-dialog";
import { ThreadShareDialog } from "./thread-share-dialog";

export interface ThreadItemProps {
  thread: Doc<"threads">;
  currentThreadId: string | null;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onThreadClick: () => void;
  isAnonymous: boolean;
  sessionId?: string;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  refreshCache: () => void;
}

export function ThreadItem({
  thread,
  currentThreadId,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onThreadClick,
  isAnonymous,
  sessionId,
  isMobile,
  setOpenMobile,
  refreshCache,
}: Readonly<ThreadItemProps>) {
  const router = useRouter();
  const isActive = currentThreadId === String(thread._id);

  const cleanTitle =
    thread.title
      ?.replace(/```[\s\S]*?```/g, "")
      ?.replace(/`([^`]*)`/g, "$1")
      ?.replace(/\n+/g, " ") || "New Chat";

  const threadUrl = `/chat/${thread._id}`;

  // Prefetch thread route on hover for better performance
  const handleThreadHover = () => {
    // Don't prefetch if we're already on this thread
    if (currentThreadId === String(thread._id)) return;

    startTransition(() => {
      router.prefetch(threadUrl);
    });
  };

  // Initialize thread actions
  const threadActions = useThreadActions({
    threadId: thread._id,
    threadTitle: cleanTitle,
    isAnonymous,
    sessionId,
    currentThreadId,
    currentlyPublic: thread.isPublic,
    onDeleteSuccess: () => {
      refreshCache();
      if (isMobile) {
        setOpenMobile(false);
      }
    },
  });

  return (
    <>
      <SidebarMenuItem
        key={thread._id}
        className="relative"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="relative group w-full">
          {/* Show rename input when editing, otherwise show normal thread button */}
          {threadActions.rename.state.isEditing ? (
            <div className="p-2">
              <ThreadRenameInput
                rename={threadActions.rename}
                className="w-full"
              />
            </div>
          ) : (
            <>
              <Link href={threadUrl} prefetch={true} onClick={onThreadClick}>
                <SidebarMenuButton
                  isActive={isActive}
                  className={`h-8 text-sm w-full justify-start text-left p-2 pr-12 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer ${
                    isActive
                      ? "bg-purple-200 dark:bg-dark-bg-tertiary/70 text-purple-900 dark:text-slate-200 border-l-4 border-purple-600 dark:border-dark-purple-glow"
                      : "hover:bg-purple-50 dark:hover:bg-dark-bg-tertiary/30"
                  }`}
                  onMouseEnter={handleThreadHover}
                  onTouchStart={(e) => {
                    // Prevent link navigation if touch started on dropdown area
                    const target = e.target as HTMLElement;
                    const dropdownArea = target.closest("[data-dropdown-area]");
                    if (dropdownArea) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {thread.parentThreadId && (
                      <GitBranch className="h-3 w-3 text-purple-600 dark:text-dark-purple-glow flex-shrink-0" />
                    )}
                    <span
                      className={`font-medium text-sm truncate ${
                        isActive
                          ? "text-purple-900 dark:text-slate-200 font-semibold"
                          : "text-purple-700 dark:text-slate-400"
                      }`}
                    >
                      {cleanTitle}
                    </span>
                  </div>
                </SidebarMenuButton>
              </Link>

              {/* Action button positioned absolutely within the button area */}
              <div
                data-dropdown-area
                className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity duration-200 ${
                  isMobile || isHovered ? "opacity-100" : "opacity-0"
                }`}
                style={{ zIndex: 20 }}
              >
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${
                        isMobile ? "h-8 w-8 p-1" : "h-6 w-6 p-0"
                      } bg-purple-600 dark:bg-dark-purple-glow hover:bg-purple-700 dark:hover:bg-dark-purple-light text-white rounded-md cursor-pointer shadow-sm border border-purple-300 dark:border-dark-purple-accent flex items-center justify-center touch-manipulation`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <MoreVertical
                        className={`${isMobile ? "h-4 w-4" : "h-3 w-3"}`}
                      />
                      <span className="sr-only">Thread actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 bg-purple-50 dark:bg-dark-bg-tertiary border border-purple-200 dark:border-dark-purple-accent shadow-lg backdrop-blur-sm"
                    sideOffset={8}
                    avoidCollisions={true}
                    collisionPadding={16}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    style={{
                      zIndex: 99999,
                    }}
                  >
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer whitespace-nowrap text-purple-700 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-dark-bg-secondary focus:bg-purple-100 dark:focus:bg-dark-bg-secondary min-h-[44px] touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation();
                        threadActions.rename.actions.startEditing();
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <PenSquare className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2 cursor-pointer whitespace-nowrap text-purple-700 dark:text-slate-300 hover:bg-purple-100 dark:hover:bg-dark-bg-secondary focus:bg-purple-100 dark:focus:bg-dark-bg-secondary min-h-[44px] touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation();
                        threadActions.share.actions.openDialog();
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Share</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="gap-2 text-red-600 dark:text-red-400 cursor-pointer whitespace-nowrap hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20 min-h-[44px] touch-manipulation"
                      onClick={(e) => {
                        e.stopPropagation();
                        threadActions.delete.actions.openConfirm();
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </SidebarMenuItem>

      {/* Render delete confirmation dialog */}
      <ThreadDeleteDialog
        delete={threadActions.delete}
        threadTitle={cleanTitle}
      />

      {/* Render share dialog */}
      <ThreadShareDialog
        shareHandler={threadActions.share}
        threadTitle={cleanTitle}
      />
    </>
  );
}
