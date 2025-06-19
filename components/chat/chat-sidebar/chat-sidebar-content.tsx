"use client";

import { useState } from "react";
import { SidebarContent } from "@/components/ui/sidebar";
import { InfiniteThreadList } from "./infinite-thread-list";
import type { Doc } from "@/convex/_generated/dataModel";

export type GroupedThreads = {
  today: Doc<"threads">[];
  yesterday: Doc<"threads">[];
  last7Days: Doc<"threads">[];
  last30Days: Doc<"threads">[];
  earlier: Doc<"threads">[];
};

export type ChatSidebarContentProps = {
  currentThreadId: string | null;
  searchQuery: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  isMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  allThreads: Doc<"threads">[];
  refreshCache: () => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasNextPage: boolean;
  loadMore: () => void;
  error: Error | null;
  isAnonymous: boolean;
  sessionId: string | null;
};

export function ChatSidebarContent({
  currentThreadId,
  searchQuery,
  user,
  isMobile,
  setOpenMobile,
  ...infiniteThreadsData
}: Readonly<ChatSidebarContentProps>) {
  const [hoveredThread, setHoveredThread] = useState<string | null>(null);

  // Close mobile sidebar when thread is clicked
  const handleThreadClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarContent className="px-3">
      <InfiniteThreadList
        currentThreadId={currentThreadId}
        searchQuery={searchQuery}
        user={user}
        isMobile={isMobile}
        setOpenMobile={setOpenMobile}
        hoveredThread={hoveredThread}
        setHoveredThread={setHoveredThread}
        onThreadClick={handleThreadClick}
        {...infiniteThreadsData}
      />
    </SidebarContent>
  );
}
