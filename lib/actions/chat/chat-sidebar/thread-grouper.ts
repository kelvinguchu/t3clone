import { useMemo } from "react";
import type { Doc } from "@/convex/_generated/dataModel";

export interface GroupedThreads {
  today: Doc<"threads">[];
  yesterday: Doc<"threads">[];
  last7Days: Doc<"threads">[];
  last30Days: Doc<"threads">[];
  earlier: Doc<"threads">[];
}

/**
 * Helper: resolve the best time to show (updatedAt fallback to _creationTime)
 * Extracted from chat-sidebar.tsx
 */
export function getThreadTime(t: Doc<"threads">): number {
  return typeof t.updatedAt === "number"
    ? t.updatedAt
    : (t as { _creationTime: number })._creationTime;
}

/**
 * Format timestamps for individual threads (only for threads within 7 days)
 * For threads older than 7 days, no individual timestamp is shown
 * Extracted from chat-sidebar.tsx
 */
export function formatTimestamp(timestamp: number): string {
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

  // For threads older than 7 days, return empty string (no individual timestamp)
  return "";
}

/**
 * Filter threads based on search query
 * Extracted from chat-sidebar.tsx
 */
export function filterThreadsBySearch(
  threads: Doc<"threads">[],
  searchQuery: string,
): Doc<"threads">[] {
  if (!searchQuery.trim()) return threads;

  return threads.filter((thread) =>
    thread.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );
}

/**
 * Group threads by time with new time periods
 * Extracted from chat-sidebar.tsx
 */
export function groupThreadsByTime(threads: Doc<"threads">[]): GroupedThreads {
  const now = new Date();
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const today: Doc<"threads">[] = [];
  const yesterday: Doc<"threads">[] = [];
  const last7Days: Doc<"threads">[] = [];
  const last30Days: Doc<"threads">[] = [];
  const earlier: Doc<"threads">[] = [];

  threads.forEach((thread) => {
    const threadTime = getThreadTime(thread);
    const threadDate = new Date(threadTime);
    const threadStart = new Date(
      threadDate.getFullYear(),
      threadDate.getMonth(),
      threadDate.getDate(),
    );

    const diffInMs = nowStart.getTime() - threadStart.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      today.push(thread);
    } else if (diffInDays === 1) {
      yesterday.push(thread);
    } else if (diffInDays < 7) {
      last7Days.push(thread);
    } else if (diffInDays < 30) {
      last30Days.push(thread);
    } else {
      earlier.push(thread);
    }
  });

  return { today, yesterday, last7Days, last30Days, earlier };
}

/**
 * Custom hook that combines search filtering and time grouping
 * Extracted from chat-sidebar.tsx
 */
export function useThreadGrouping(
  threadsData: Doc<"threads">[],
  searchQuery: string,
): GroupedThreads {
  return useMemo(() => {
    const filteredThreads = filterThreadsBySearch(threadsData, searchQuery);
    return groupThreadsByTime(filteredThreads);
  }, [threadsData, searchQuery]);
}
