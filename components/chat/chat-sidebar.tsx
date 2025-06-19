"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import { ChatSidebarHeader } from "./chat-sidebar/chat-sidebar-header";
import { ChatSidebarContent } from "./chat-sidebar/chat-sidebar-content";
import { ChatSidebarFooter } from "./chat-sidebar/chat-sidebar-footer";
import {
  useThreadCreator,
  useNewChatHandler,
} from "@/lib/actions/chat/chat-sidebar";
import { useInfiniteThreads } from "@/lib/hooks/use-infinite-threads";

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

  // Lift useInfiniteThreads hook to the parent component
  const { allThreads, refreshCache, ...infiniteThreadsData } =
    useInfiniteThreads();

  // Use extracted thread creator
  const threadCreator = useThreadCreator(user);

  // Use extracted new chat handler, now with refreshCache
  const handleNewChat = useNewChatHandler({
    user,
    threadCreator,
    onNewThread: () => {
      // Invalidate cache to show the new thread immediately
      refreshCache();
      if (isMobile) {
        setOpenMobile(false);
      }
    },
  });

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
    <Sidebar className="border-none bg-purple-100 dark:bg-dark-bg-secondary [&[data-mobile=true]]:bg-purple-100 [&[data-mobile=true]]:dark:bg-dark-bg-secondary">
      <ChatSidebarHeader
        handleNewChat={handleNewChat}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <ChatSidebarContent
        currentThreadId={currentThreadId}
        searchQuery={searchQuery}
        user={user}
        isMobile={isMobile}
        setOpenMobile={setOpenMobile}
        // Pass down all threads and the refresh function
        allThreads={allThreads}
        refreshCache={refreshCache}
        // Pass down the rest of the infinite scroll data
        {...infiniteThreadsData}
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
