"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAnonymousSessionReactive } from "@/lib/hooks/use-anonymous-session-reactive";
import { Sidebar } from "@/components/ui/sidebar";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { usePathname, useRouter } from "next/navigation";
import { ChatSidebarHeader } from "./chat-sidebar-header";
import { ChatSidebarContent } from "./chat-sidebar-content";
import { ChatSidebarFooter } from "./chat-sidebar-footer";

export function ChatSidebar() {
  const { isLoaded, user } = useUser();
  const {
    sessionData,
    sessionId,
    isLoading: anonSessionLoading,
  } = useAnonymousSessionReactive();
  const [searchQuery, setSearchQuery] = useState("");
  console.log("[Sidebar] user:", user);
  console.log("[Sidebar] sessionId:", sessionId);

  const pathname = usePathname();
  const currentThreadId = pathname?.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;

  const { signOut } = useClerk();
  const router = useRouter();

  // Load user threads from Convex
  const userThreads = useQuery(
    api.threads.getUserThreads,
    user?.id ? { userId: user.id } : "skip",
  );
  console.log("[Sidebar] userThreads:", userThreads);

  // Load anonymous threads from Convex using reactive session ID
  const anonymousThreads = useQuery(
    api.threads.getAnonymousThreads,
    sessionId ? { sessionId } : "skip",
  );
  console.log("[Sidebar] anonymousThreads:", anonymousThreads);

  // Always include anonymous threads; for authenticated users these may be
  // transient until they are claimed/promoted, but should still appear.
  const combinedThreads = [...(userThreads ?? []), ...(anonymousThreads ?? [])];

  // Deduplicate by _id in case a thread was just promoted from anonymous → user
  const threadsData = Array.from(
    new Map(combinedThreads.map((t) => [String(t._id), t])).values(),
  );
  console.log("[Sidebar] threadsData:", threadsData);

  // Debug: log the current thread list whenever it changes
  useEffect(() => {
    // Thread data updated
  }, [threadsData]);

  // --- Mutations with optimistic updates -----------------------------------
  const createThread = useMutation(
    api.threads.createThread,
  ).withOptimisticUpdate((localStore, args) => {
    if (!user) return;

    const tempId = ("optimistic-" +
      Math.random().toString(36).slice(2)) as Id<"threads">;
    const now = Date.now();

    const newThread = {
      _id: tempId,
      _creationTime: now,
      title: args.title,
      userId: user.id,
      isAnonymous: false,
      sessionId: undefined,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    } as unknown as Doc<"threads">;

    const existing =
      localStore.getQuery(api.threads.getUserThreads, { userId: user.id }) ??
      [];
    localStore.setQuery(api.threads.getUserThreads, { userId: user.id }, [
      newThread,
      ...existing,
    ]);
  });

  const createAnonymousThread = useMutation(
    api.threads.createAnonymousThread,
  ).withOptimisticUpdate((localStore, args) => {
    const tempId = ("optimistic-" +
      Math.random().toString(36).slice(2)) as Id<"threads">;
    const now = Date.now();

    const newThread = {
      _id: tempId,
      _creationTime: now,
      title: args.title,
      userId: undefined,
      isAnonymous: true,
      sessionId: args.sessionId,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    } as unknown as Doc<"threads">;

    const existing =
      localStore.getQuery(api.threads.getAnonymousThreads, {
        sessionId: args.sessionId,
      }) ?? [];
    localStore.setQuery(
      api.threads.getAnonymousThreads,
      { sessionId: args.sessionId },
      [newThread, ...existing],
    );
  });

  const handleNewChat = async () => {
    if (!user && !sessionId) return;

    try {
      let threadId;

      if (user) {
        // Authenticated user
        threadId = await createThread({
          title: "New Chat",
          model: "gemini-2.0-flash",
        });
      } else {
        // Anonymous user
        if ((threadsData?.length || 0) >= 5) {
          alert(
            "You've reached the conversation limit. Please sign in for unlimited chats.",
          );
          return;
        }

        threadId = await createAnonymousThread({
          sessionId: sessionId!,
          ipHash: sessionData?.ipHash ?? "unknown",
          title: "New Chat",
          model: "gemini-2.0-flash",
        });
      }

      // Navigate to the new thread
      if (threadId) {
        router.push(`/chat/${threadId}`);
      }
    } catch {
      // Failed to create new chat
    }
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

  // Filter threads based on search query
  const filteredThreads =
    threadsData?.filter((thread) =>
      thread.title.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  // Group threads by time with precise grouping
  const groupedThreads = {
    today: filteredThreads.filter(
      (t) => formatTimestamp(getThreadTime(t)) === "Today",
    ),
    yesterday: filteredThreads.filter(
      (t) => formatTimestamp(getThreadTime(t)) === "Yesterday",
    ),
    older: filteredThreads.filter(
      (t) =>
        formatTimestamp(getThreadTime(t)) !== "Today" &&
        formatTimestamp(getThreadTime(t)) !== "Yesterday",
    ),
  };

  const handleSignOut = async () => {
    try {
      // Clerk supports redirectUrl parameter to navigate after sign-out.
      await signOut({ redirectUrl: "/chat" });
    } catch {
      // Fallback – ensure we still land on /chat even if Clerk redirect fails.
      router.replace("/chat");
    }
  };

  // Prevent hydration mismatch: ensure we only render dynamic Footer content
  // after the component has mounted on the client. Until then we render a
  // static placeholder that matches the server HTML.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Determine loading state more accurately:
  // 1. Authenticated users -> wait for userThreads
  // 2. Anonymous users -> wait for the anonymous session to initialise *and* the threads query
  const threadsLoading = user
    ? userThreads === undefined
    : anonSessionLoading || anonymousThreads === undefined;

  return (
    <Sidebar className="border-none bg-purple-100 dark:bg-purple-900">
      <ChatSidebarHeader
        handleNewChat={handleNewChat}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <ChatSidebarContent
        threadsLoading={threadsLoading}
        groupedThreads={groupedThreads}
        currentThreadId={currentThreadId}
        searchQuery={searchQuery}
        user={user}
      />

      <ChatSidebarFooter
        hasMounted={hasMounted}
        isLoaded={isLoaded}
        user={user}
        handleSignOut={handleSignOut}
      />
    </Sidebar>
  );
}
