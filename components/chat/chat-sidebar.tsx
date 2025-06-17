"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { ChatSidebarHeader } from "./chat-sidebar-header";
import { ChatSidebarContent } from "./chat-sidebar-content";
import { ChatSidebarFooter } from "./chat-sidebar-footer";
import {
  useThreadsFetcher,
  useThreadCreator,
  useThreadGrouping,
  useNewChatHandler,
} from "@/lib/actions/chat/chat-sidebar";

export function ChatSidebar() {
  const { isLoaded, user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");

  // Get mobile sidebar state from context
  const { isMobile, setOpenMobile } = useSidebar();

  const pathname = usePathname();
  const currentThreadId = pathname?.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;

  const { signOut } = useClerk();
  const router = useRouter();

  // Use extracted thread fetcher (now includes sessionData to avoid duplicate calls)
  const { threadsData, threadsLoading, sessionId, sessionData } =
    useThreadsFetcher();

  // Use extracted thread creator
  const threadCreator = useThreadCreator(user);

  // Use extracted new chat handler
  const handleNewChat = useNewChatHandler({
    user,
    sessionId,
    sessionData,
    threadsData,
    threadCreator,
  });

  // Use extracted thread grouping
  const groupedThreads = useThreadGrouping(threadsData, searchQuery);

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

  return (
    <Sidebar className="border-none bg-purple-100 dark:bg-purple-900 [&[data-mobile=true]]:bg-purple-100 [&[data-mobile=true]]:dark:bg-purple-900">
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
        isMobile={isMobile}
        setOpenMobile={setOpenMobile}
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
