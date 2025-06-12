"use client";

import { useState, useEffect } from "react";
import { useUser, SignInButton, useClerk } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAnonymousSessionReactive } from "@/lib/hooks/use-anonymous-session-reactive";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  MessageSquare,
  Settings,
  User,
  LogOut,
  Crown,
  Github,
  ExternalLink,
  ChevronDown,
  PenSquare,
  Trash2,
  MoreHorizontal,
  LogIn,
  GitBranch,
} from "lucide-react";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { usePathname, useRouter } from "next/navigation";

export function ChatSidebar() {
  const { isLoaded, user } = useUser();
  const {
    sessionData,
    isLoading: sessionLoading,
    sessionId,
    threadCount,
  } = useAnonymousSessionReactive();
  const [searchQuery, setSearchQuery] = useState("");

  const pathname = usePathname();
  const currentThreadId = pathname?.startsWith("/chat/")
    ? pathname.split("/")[2]
    : null;

  const { signOut } = useClerk();
  const router = useRouter();

  // Debug logging
  console.log("🔍 Sidebar: User state:", { isLoaded, userId: user?.id });
  console.log("🔍 Sidebar: Session state:", {
    sessionLoading,
    sessionId: sessionData?.sessionId,
    messageCount: sessionData?.messageCount,
    remainingMessages: sessionData?.remainingMessages,
  });

  // Load user threads from Convex
  const userThreads = useQuery(
    api.threads.getUserThreads,
    user?.id ? { userId: user.id } : "skip",
  );

  // Load anonymous threads from Convex using reactive session ID
  const anonymousThreads = useQuery(
    api.threads.getAnonymousThreads,
    sessionId ? { sessionId } : "skip",
  );

  // Debug the query state
  console.log("🔍 Sidebar: Query state details:", {
    sessionAvailable: !!sessionId,
    queryArgs: sessionId ? { sessionId } : "skip",
    queryResult: anonymousThreads,
    isSkipped: !sessionId,
    convexThreadCount: threadCount,
  });

  console.log("🔍 Sidebar: Threads query results:", {
    userThreads: userThreads?.length ?? 0,
    anonymousThreads: anonymousThreads?.length ?? 0,
    isAuthenticated: !!user,
    isQuerySkipped: !sessionData?.sessionId,
  });

  // Always include anonymous threads; for authenticated users these may be
  // transient until they are claimed/promoted, but should still appear.
  const combinedThreads = [...(userThreads ?? []), ...(anonymousThreads ?? [])];

  // Deduplicate by _id in case a thread was just promoted from anonymous → user
  const threadsData = Array.from(
    new Map(combinedThreads.map((t) => [String(t._id), t])).values(),
  );

  // Debug: log the current thread list whenever it changes
  useEffect(() => {
    console.log(
      "📋 Sidebar: threadsData updated (length =",
      threadsData.length,
      ")",
      threadsData.map((t) => ({
        id: t._id,
        title: t.title,
        updatedAt: t.updatedAt,
      })),
    );
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
      systemPrompt: args.systemPrompt,
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
      systemPrompt: args.systemPrompt,
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
      if (threadId && typeof window !== "undefined") {
        window.location.href = `/chat/${threadId}`;
      }
    } catch (error) {
      console.error("Failed to create new chat:", error);
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
    } catch (err) {
      console.error("Error during sign out", err);
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

  const threadsLoading = user
    ? userThreads === undefined
    : anonymousThreads === undefined;

  return (
    <Sidebar className="border-none bg-purple-100 dark:bg-purple-900">
      <SidebarHeader className="p-4 pb-3 bg-purple-100 dark:bg-purple-900 rounded-tr-2xl">
        {/* Brand Header */}
        <div className="flex items-center justify-center">
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            T3.chat
          </h1>
        </div>

        {/* New Chat Button */}
        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/25 transition-all duration-300 hover:shadow-purple-500/40 hover:scale-[1.02] group h-9"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" />
          Start New Chat
        </Button>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-purple-400" />
          <Input
            placeholder="Search conversations..."
            className="pl-8 h-8 text-sm bg-white/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/50 focus:border-purple-400 focus:ring-purple-400/20 placeholder:text-purple-400/70"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </SidebarHeader>

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
                    {groupedThreads.today.map((thread) => {
                      const isActive = currentThreadId === String(thread._id);
                      return (
                        <SidebarMenuItem key={thread._id} className="group">
                          <div className="relative">
                            <SidebarMenuButton
                              className={`w-full justify-start p-3 pr-10 transition-all duration-200 rounded-lg border ${isActive ? "bg-purple-200/60 dark:bg-purple-800/40 border-purple-400 dark:border-purple-600" : "hover:bg-purple-100/80 dark:hover:bg-purple-900/30 border-transparent hover:border-purple-200 dark:hover:border-purple-800/50"}`}
                              onClick={() => {
                                if (typeof window !== "undefined") {
                                  window.location.href = `/chat/${thread._id}`;
                                }
                              }}
                            >
                              <div className="flex items-center gap-3 w-full min-w-0">
                                {thread.parentThreadId && (
                                  <GitBranch className="h-4 w-4 text-purple-500 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-purple-900 dark:text-purple-100 truncate">
                                    {thread.title
                                      .replace(/```[\s\S]*?```/g, "")
                                      .replace(/`([^`]*)`/g, "$1")
                                      .replace(/\n+/g, " ") || "New Chat"}
                                  </div>
                                </div>
                              </div>
                            </SidebarMenuButton>

                            {/* Thread Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-purple-200 dark:hover:bg-purple-800 z-10"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem className="gap-2">
                                  <PenSquare className="h-4 w-4" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2">
                                  <ExternalLink className="h-4 w-4" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-red-600 dark:text-red-400">
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
                    {groupedThreads.yesterday.map((thread) => {
                      const isActive = currentThreadId === String(thread._id);
                      return (
                        <SidebarMenuItem key={thread._id} className="group">
                          <div className="relative">
                            <SidebarMenuButton
                              className={`w-full justify-start p-3 pr-10 transition-all duration-200 rounded-lg border ${isActive ? "bg-purple-200/60 dark:bg-purple-800/40 border-purple-400 dark:border-purple-600" : "hover:bg-purple-100/80 dark:hover:bg-purple-900/30 border-transparent hover:border-purple-200 dark:hover:border-purple-800/50"}`}
                              onClick={() => {
                                if (typeof window !== "undefined") {
                                  window.location.href = `/chat/${thread._id}`;
                                }
                              }}
                            >
                              <div className="flex items-center gap-3 w-full min-w-0">
                                {thread.parentThreadId && (
                                  <GitBranch className="h-4 w-4 text-purple-500 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-purple-800 dark:text-purple-200 truncate">
                                    {thread.title
                                      .replace(/```[\s\S]*?```/g, "")
                                      .replace(/`([^`]*)`/g, "$1")
                                      .replace(/\n+/g, " ") || "New Chat"}
                                  </div>
                                </div>
                              </div>
                            </SidebarMenuButton>

                            {/* Thread Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-purple-200 dark:hover:bg-purple-800 z-10"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem className="gap-2">
                                  <PenSquare className="h-4 w-4" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2">
                                  <ExternalLink className="h-4 w-4" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-red-600 dark:text-red-400">
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
                      return (
                        <SidebarMenuItem key={thread._id} className="group">
                          <div className="relative">
                            <SidebarMenuButton
                              className={`w-full justify-start p-3 pr-10 transition-all duration-200 rounded-lg border ${isActive ? "bg-purple-200/60 dark:bg-purple-800/40 border-purple-400 dark:border-purple-600" : "hover:bg-purple-100/80 dark:hover:bg-purple-900/30 border-transparent hover:border-purple-200 dark:hover:border-purple-800/50"}`}
                              onClick={() => {
                                if (typeof window !== "undefined") {
                                  window.location.href = `/chat/${thread._id}`;
                                }
                              }}
                            >
                              <div className="flex items-center gap-3 w-full min-w-0">
                                {thread.parentThreadId && (
                                  <GitBranch className="h-4 w-4 text-purple-500 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-purple-700 dark:text-purple-300 truncate">
                                    {thread.title
                                      .replace(/```[\s\S]*?```/g, "")
                                      .replace(/`([^`]*)`/g, "$1")
                                      .replace(/\n+/g, " ") || "New Chat"}
                                  </div>
                                  <div className="text-xs text-purple-400/70 dark:text-purple-500/70 truncate">
                                    {formatTimestamp(getThreadTime(thread))}
                                  </div>
                                </div>
                              </div>
                            </SidebarMenuButton>

                            {/* Thread Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-purple-200 dark:hover:bg-purple-800 z-10"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem className="gap-2">
                                  <PenSquare className="h-4 w-4" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-2">
                                  <ExternalLink className="h-4 w-4" />
                                  Share
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-red-600 dark:text-red-400">
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

              {filteredThreads.length === 0 && searchQuery && (
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
              {filteredThreads.length === 0 && !searchQuery && (
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

      <SidebarFooter className="p-4">
        <SidebarSeparator className="mb-4 bg-purple-200/50 dark:bg-purple-800/30" />

        {!hasMounted || !isLoaded ? (
          /* Render an invisible placeholder so server & first client render match,
             preventing a hydration mismatch while Clerk finishes loading or until
             after the component has mounted. */
          <div
            className="h-12 w-full opacity-0 pointer-events-none select-none"
            aria-hidden="true"
          />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full p-3 h-auto hover:bg-purple-100/80 dark:hover:bg-purple-900/30 transition-all duration-200 rounded-xl group"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-purple-200 dark:border-purple-800">
                      <AvatarImage src={user.imageUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-purple-600 to-purple-700 text-white font-semibold">
                        {user.firstName?.charAt(0) ??
                          user.emailAddresses[0]?.emailAddress.charAt(0) ??
                          "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-white dark:border-purple-950 rounded-full" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-purple-900 dark:text-purple-100 text-sm">
                      {user.fullName ??
                        user.firstName ??
                        user.emailAddresses[0]?.emailAddress.split("@")[0] ??
                        "User"}
                    </div>
                    <div className="flex items-center gap-1">
                      <Crown className="h-3 w-3 text-purple-600" />
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        {(user.publicMetadata?.plan as string) || "Free Plan"}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-purple-600 group-hover:rotate-180 transition-transform duration-200" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mb-2">
              <DropdownMenuItem className="gap-2">
                <User className="h-4 w-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Settings className="h-4 w-4" />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2">
                <Github className="h-4 w-4" />
                GitHub
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <div
                  className="flex items-center gap-2 w-full cursor-pointer text-red-600 dark:text-red-400"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <SignInButton
            mode="modal"
            forceRedirectUrl="/chat"
            signUpForceRedirectUrl="/chat"
          >
            <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-500/25">
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          </SignInButton>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
