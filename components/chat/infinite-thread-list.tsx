"use client";

import { useEffect, useRef, useCallback } from "react";
import { SidebarMenu } from "@/components/ui/sidebar";
import { ThreadItem } from "./thread-item";
import { useInfiniteThreads } from "@/lib/hooks/use-infinite-threads";
import { useThreadGrouping } from "@/lib/actions/chat/chat-sidebar";
import type { GroupedThreads } from "./chat-sidebar-content";

export interface InfiniteThreadListProps {
  currentThreadId: string | null;
  searchQuery: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  hoveredThread: string | null;
  setHoveredThread: (threadId: string | null) => void;
  onThreadClick: () => void;
}

export function InfiniteThreadList({
  currentThreadId,
  searchQuery,
  user,
  isMobile,
  setOpenMobile,
  hoveredThread,
  setHoveredThread,
  onThreadClick,
}: Readonly<InfiniteThreadListProps>) {
  const {
    allThreads,
    isLoading,
    isLoadingMore,
    hasNextPage,
    loadMore,
    error,
    isAnonymous,
    sessionId,
  } = useInfiniteThreads();

  // Group threads for display
  const groupedThreads = useThreadGrouping(allThreads, searchQuery);

  // Ref for the container to detect scroll
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isLoadingMore) {
        loadMore();
      }
    },
    [hasNextPage, isLoadingMore, loadMore],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: "100px", // Start loading 100px before reaching the bottom
      threshold: 0.1,
    });

    const currentLoadMoreRef = loadMoreRef.current;
    if (currentLoadMoreRef) {
      observer.observe(currentLoadMoreRef);
    }

    return () => {
      if (currentLoadMoreRef) {
        observer.unobserve(currentLoadMoreRef);
      }
    };
  }, [handleIntersection]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-red-600 dark:text-red-400 font-medium mb-2">
          Failed to load threads
        </p>
        <p className="text-red-500/70 dark:text-red-400/70 text-sm">
          {error.message || "An unexpected error occurred"}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0">
      {isLoading ? (
        // Show loading while initial data loads
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="h-4 w-4 bg-purple-200 dark:bg-dark-purple-light rounded animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-purple-200 dark:bg-dark-purple-light rounded animate-pulse" />
                <div className="h-3 bg-purple-100 dark:bg-dark-bg-tertiary rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <ThreadGroup
            title="Today"
            threads={groupedThreads.today}
            currentThreadId={currentThreadId}
            hoveredThread={hoveredThread}
            setHoveredThread={setHoveredThread}
            onThreadClick={onThreadClick}
            isAnonymous={isAnonymous}
            sessionId={sessionId}
            isMobile={isMobile}
            setOpenMobile={setOpenMobile}
          />

          <ThreadGroup
            title="Yesterday"
            threads={groupedThreads.yesterday}
            currentThreadId={currentThreadId}
            hoveredThread={hoveredThread}
            setHoveredThread={setHoveredThread}
            onThreadClick={onThreadClick}
            isAnonymous={isAnonymous}
            sessionId={sessionId}
            isMobile={isMobile}
            setOpenMobile={setOpenMobile}
          />

          <ThreadGroup
            title="Last 7 days"
            threads={groupedThreads.last7Days}
            currentThreadId={currentThreadId}
            hoveredThread={hoveredThread}
            setHoveredThread={setHoveredThread}
            onThreadClick={onThreadClick}
            isAnonymous={isAnonymous}
            sessionId={sessionId}
            isMobile={isMobile}
            setOpenMobile={setOpenMobile}
          />

          <ThreadGroup
            title="Last 30 days"
            threads={groupedThreads.last30Days}
            currentThreadId={currentThreadId}
            hoveredThread={hoveredThread}
            setHoveredThread={setHoveredThread}
            onThreadClick={onThreadClick}
            isAnonymous={isAnonymous}
            sessionId={sessionId}
            isMobile={isMobile}
            setOpenMobile={setOpenMobile}
          />

          <ThreadGroup
            title="Earlier"
            threads={groupedThreads.earlier}
            currentThreadId={currentThreadId}
            hoveredThread={hoveredThread}
            setHoveredThread={setHoveredThread}
            onThreadClick={onThreadClick}
            isAnonymous={isAnonymous}
            sessionId={sessionId}
            isMobile={isMobile}
            setOpenMobile={setOpenMobile}
          />

          {/* Loading more indicator */}
          {hasNextPage && (
            <div
              ref={loadMoreRef}
              className="flex items-center justify-center py-4"
            >
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-purple-600 dark:text-slate-400">
                  <div className="h-4 w-4 border-2 border-purple-600 dark:border-dark-purple-glow border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading more threads...</span>
                </div>
              ) : (
                <div className="h-4" /> // Invisible trigger for intersection observer
              )}
            </div>
          )}

          {/* Empty state when no threads and search query */}
          {allThreads.length === 0 && searchQuery && (
            <div className="text-center py-8">
              <div className="h-12 w-12 text-purple-300 mx-auto mb-3">
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  className="w-full h-full"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="text-purple-600 dark:text-slate-300 font-medium">
                No conversations found
              </p>
              <p className="text-purple-500/70 dark:text-slate-400 text-sm">
                Try a different search term
              </p>
            </div>
          )}

          {/* Empty state when no threads */}
          {allThreads.length === 0 && !searchQuery && (
            <div className="text-center py-8">
              <div className="h-12 w-12 text-purple-300 mx-auto mb-3">
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  className="w-full h-full"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-purple-600 dark:text-slate-300 font-medium">
                Start your first conversation
              </p>
              {user && (
                <p className="text-purple-500/70 dark:text-slate-400 text-sm">
                  Your chats will be saved here
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component for rendering thread groups
interface ThreadGroupProps {
  title: string;
  threads: GroupedThreads[keyof GroupedThreads];
  currentThreadId: string | null;
  hoveredThread: string | null;
  setHoveredThread: (threadId: string | null) => void;
  onThreadClick: () => void;
  isAnonymous: boolean;
  sessionId: string | null;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
}

function ThreadGroup({
  title,
  threads,
  currentThreadId,
  hoveredThread,
  setHoveredThread,
  onThreadClick,
  isAnonymous,
  sessionId,
  isMobile,
  setOpenMobile,
}: Readonly<ThreadGroupProps>) {
  if (threads.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-purple-700 dark:text-slate-300">
          {title}
        </h2>
        <div className="bg-purple-100 text-purple-700 dark:bg-dark-bg-tertiary dark:text-slate-400 text-xs px-2 py-1 rounded-md">
          {threads.length}
        </div>
      </div>
      <SidebarMenu>
        {threads.map((thread) => {
          const isHovered = hoveredThread === String(thread._id);
          return (
            <ThreadItem
              key={thread._id}
              thread={thread}
              currentThreadId={currentThreadId}
              isHovered={isHovered}
              onMouseEnter={() => setHoveredThread(String(thread._id))}
              onMouseLeave={() => setHoveredThread(null)}
              onThreadClick={onThreadClick}
              isAnonymous={isAnonymous}
              sessionId={sessionId ?? undefined}
              isMobile={isMobile}
              setOpenMobile={setOpenMobile}
            />
          );
        })}
      </SidebarMenu>
    </div>
  );
}
