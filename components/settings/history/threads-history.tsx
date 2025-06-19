"use client";

import { useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  MessageSquare,
  Search,
  Trash2,
  ExternalLink,
  AlertCircle,
  SortAsc,
  SortDesc,
  Filter,
  RefreshCw,
} from "lucide-react";
import { getModelInfo } from "@/lib/ai-providers";
import { useThreadDelete } from "@/lib/actions/chat/chat-sidebar/thread-delete-handler";
import { Id } from "@/convex/_generated/dataModel";

type SortOption = "newest" | "oldest" | "mostMessages" | "leastMessages";
type FilterOption = "all" | "today" | "week" | "month" | "older";

interface Thread {
  _id: string;
  title: string;
  model: string;
  updatedAt: number;
  isPublic?: boolean;
  isAnonymous?: boolean;
  sessionId?: string;
  userId?: string;
}

interface ThreadHistoryItemProps {
  thread: Thread;
  messageCount?: number;
}

function ThreadHistoryItem({ thread, messageCount }: ThreadHistoryItemProps) {
  const getModelDisplayInfo = (modelId: string) => {
    try {
      return getModelInfo(modelId as Parameters<typeof getModelInfo>[0]);
    } catch {
      return {
        name: modelId,
        icon: "/brand-icons/llama.svg",
        theme: "gray",
      };
    }
  };

  const modelInfo = getModelDisplayInfo(thread.model);

  // Check if this thread was synced from anonymous to authenticated
  const isSyncedThread =
    thread.isAnonymous && thread.userId && thread.sessionId;

  const { state, actions } = useThreadDelete({
    threadId: thread._id as Id<"threads">,
    threadTitle: thread.title,
    isAnonymous: thread.isAnonymous || false,
    sessionId: thread.sessionId,
  });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <TableRow className="bg-white dark:bg-dark-bg-secondary hover:bg-purple-50 dark:hover:bg-purple-900/10">
      <TableCell className="p-2 sm:p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-purple-900 dark:text-purple-100 text-sm sm:text-base truncate">
              {thread.title}
            </h3>
            {thread.isPublic && (
              <Badge
                variant="secondary"
                className="text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 shrink-0"
              >
                Shared
              </Badge>
            )}
            {isSyncedThread && (
              <Badge
                variant="secondary"
                className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 shrink-0 flex items-center gap-1"
                title="This conversation was started anonymously and later synced to your account"
              >
                <RefreshCw className="h-3 w-3" />
                Synced
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 sm:hidden">
            <div className="w-3 h-3 bg-purple-100 dark:bg-dark-bg-tertiary rounded flex items-center justify-center">
              <img
                src={modelInfo.icon}
                alt={modelInfo.name}
                className="h-2 w-2"
              />
            </div>
            <span>{modelInfo.name}</span>
            <span>•</span>
            <span>{formatDate(thread.updatedAt)}</span>
            <span>•</span>
            <span>{messageCount || 0} msgs</span>
          </div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1 md:hidden">
            {formatDate(thread.updatedAt)}
          </div>
        </div>
      </TableCell>
      <TableCell className="p-2 sm:p-4 hidden sm:table-cell">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-100 dark:bg-dark-bg-tertiary rounded-lg flex items-center justify-center">
            <img
              src={modelInfo.icon}
              alt={modelInfo.name}
              className="h-4 w-4"
            />
          </div>
          <span className="text-sm text-purple-900 dark:text-purple-100">
            {modelInfo.name}
          </span>
        </div>
      </TableCell>
      <TableCell className="p-2 sm:p-4 hidden md:table-cell">
        <span className="text-sm text-purple-600 dark:text-purple-400">
          {formatDate(thread.updatedAt)}
        </span>
      </TableCell>
      <TableCell className="p-2 sm:p-4">
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => window.open(`/chat/${thread._id}`, "_blank")}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>

          <AlertDialog
            open={state.isConfirmOpen}
            onOpenChange={actions.closeConfirm}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={actions.openConfirm}
                className="h-8 w-8 p-0 border-purple-200 dark:border-purple-800 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &ldquo;{thread.title}&rdquo;?
                  This action cannot be undone and will permanently delete all
                  messages in this conversation.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={state.isDeleting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={actions.confirmDelete}
                  disabled={state.isDeleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {state.isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
              {state.error && (
                <div className="text-destructive text-sm mt-2">
                  {state.error}
                </div>
              )}
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ThreadsHistory() {
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [selectedModel, setSelectedModel] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Get all threads for the user
  const threads = useQuery(
    api.threads.getUserThreads,
    user?.id ? { userId: user.id } : "skip",
  );

  // Get message counts for all threads using bulk query
  const threadIds = useMemo(() => {
    if (!threads) return [];
    return threads.map((thread: Thread) => thread._id as Id<"threads">);
  }, [threads]);

  const messageCounts = useQuery(
    api.messages.getBulkMessageCounts,
    user?.id && threadIds.length > 0 ? { threadIds, userId: user.id } : "skip",
  );

  const threadMessageCounts = useMemo(() => {
    if (!messageCounts) return new Map<string, number>();

    const counts = new Map<string, number>();
    Object.entries(messageCounts).forEach(([threadId, count]) => {
      counts.set(threadId, count);
    });
    return counts;
  }, [messageCounts]);

  // Get unique models from threads
  const availableModels = useMemo(() => {
    if (!threads) return [];
    const models = [...new Set(threads.map((thread: Thread) => thread.model))];
    return models.sort();
  }, [threads]);

  // Filter and sort threads
  const filteredAndSortedThreads = useMemo(() => {
    if (!threads) return [];

    const filtered = threads.filter((thread: Thread) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!thread.title.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Model filter
      if (selectedModel !== "all" && thread.model !== selectedModel) {
        return false;
      }

      // Date filter
      if (filterBy !== "all") {
        const now = Date.now();
        const threadDate = thread.updatedAt;
        const dayMs = 24 * 60 * 60 * 1000;

        switch (filterBy) {
          case "today":
            if (now - threadDate > dayMs) return false;
            break;
          case "week":
            if (now - threadDate > 7 * dayMs) return false;
            break;
          case "month":
            if (now - threadDate > 30 * dayMs) return false;
            break;
          case "older":
            if (now - threadDate <= 30 * dayMs) return false;
            break;
        }
      }

      return true;
    });

    // Sort threads
    filtered.sort((a: Thread, b: Thread) => {
      switch (sortBy) {
        case "newest":
          return b.updatedAt - a.updatedAt;
        case "oldest":
          return a.updatedAt - b.updatedAt;
        case "mostMessages": {
          const aCount = threadMessageCounts.get(a._id) || 0;
          const bCount = threadMessageCounts.get(b._id) || 0;
          return bCount - aCount; // Most messages first
        }
        case "leastMessages": {
          const aCount = threadMessageCounts.get(a._id) || 0;
          const bCount = threadMessageCounts.get(b._id) || 0;
          return aCount - bCount; // Least messages first
        }
        default:
          return b.updatedAt - a.updatedAt;
      }
    });

    return filtered;
  }, [
    threads,
    searchQuery,
    sortBy,
    filterBy,
    selectedModel,
    threadMessageCounts,
  ]);

  // Pagination calculations
  const totalItems = filteredAndSortedThreads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedThreads = filteredAndSortedThreads.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterBy, selectedModel]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push("ellipsis");
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const getModelDisplayInfo = (modelId: string) => {
    try {
      return getModelInfo(modelId as Parameters<typeof getModelInfo>[0]);
    } catch {
      return {
        name: modelId,
        icon: "/brand-icons/llama.svg",
        theme: "gray",
      };
    }
  };

  if (!user) {
    return (
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 sm:p-6 lg:p-8 text-center border border-purple-200/60 dark:border-purple-800/50">
        <AlertCircle className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
        <h3 className="text-base sm:text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
          Authentication Required
        </h3>
        <p className="text-sm sm:text-base text-purple-700 dark:text-purple-300">
          Please sign in to view your conversation history.
        </p>
      </div>
    );
  }

  if (!threads) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-purple-200 dark:bg-purple-800/50 rounded w-1/4"></div>
          <div className="h-8 bg-purple-200 dark:bg-purple-800/50 rounded w-full"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-purple-200 dark:bg-purple-800/50 rounded w-full"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-purple-900 dark:text-purple-100">
            Conversation History
          </h2>
          <p className="text-purple-700 dark:text-purple-300 text-xs sm:text-sm">
            {totalItems > 0 ? (
              <>
                Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of{" "}
                {totalItems} conversation{totalItems !== 1 ? "s" : ""}
                {totalItems !== threads.length &&
                  ` (filtered from ${threads.length} total)`}
              </>
            ) : (
              `${threads.length} conversation${threads.length !== 1 ? "s" : ""} total`
            )}
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-400 dark:text-purple-500" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/70 dark:bg-dark-bg-tertiary/60 border-purple-200 dark:border-purple-800 focus:border-purple-400 dark:focus:border-purple-600"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select
              value={sortBy}
              onValueChange={(value: SortOption) => setSortBy(value)}
            >
              <SelectTrigger className="w-full sm:w-[160px] border-purple-200 dark:border-purple-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-dark-bg-secondary border-purple-200 dark:border-purple-800">
                <SelectItem
                  value="newest"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  <div className="flex items-center gap-2">
                    <SortDesc className="h-4 w-4" />
                    Newest first
                  </div>
                </SelectItem>
                <SelectItem
                  value="oldest"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  <div className="flex items-center gap-2">
                    <SortAsc className="h-4 w-4" />
                    Oldest first
                  </div>
                </SelectItem>
                <SelectItem
                  value="mostMessages"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  Most messages
                </SelectItem>
                <SelectItem
                  value="leastMessages"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  Least messages
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterBy}
              onValueChange={(value: FilterOption) => setFilterBy(value)}
            >
              <SelectTrigger className="w-full sm:w-[120px] border-purple-200 dark:border-purple-800">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-dark-bg-secondary border-purple-200 dark:border-purple-800">
                <SelectItem
                  value="all"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  All time
                </SelectItem>
                <SelectItem
                  value="today"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  Today
                </SelectItem>
                <SelectItem
                  value="week"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  This week
                </SelectItem>
                <SelectItem
                  value="month"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  This month
                </SelectItem>
                <SelectItem
                  value="older"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  Older
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-full sm:w-[140px] border-purple-200 dark:border-purple-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-dark-bg-secondary border-purple-200 dark:border-purple-800">
                <SelectItem
                  value="all"
                  className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                >
                  All models
                </SelectItem>
                {availableModels.map((model: string) => {
                  const modelInfo = getModelDisplayInfo(model);
                  return (
                    <SelectItem
                      key={model}
                      value={model}
                      className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={modelInfo.icon}
                          alt={modelInfo.name}
                          className="h-4 w-4"
                        />
                        {modelInfo.name}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      {filteredAndSortedThreads.length === 0 ? (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 sm:p-6 lg:p-8 text-center border border-purple-200/60 dark:border-purple-800/50">
          <MessageSquare className="h-12 w-12 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
            No conversations found
          </h3>
          {searchQuery ? (
            <p className="text-sm sm:text-base text-purple-700 dark:text-purple-300">
              Try adjusting your search or filters
            </p>
          ) : (
            <p className="text-sm sm:text-base text-purple-700 dark:text-purple-300">
              Start a new conversation to see it here
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="border border-purple-200/60 dark:border-purple-800/50 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-50 dark:hover:bg-purple-900/20">
                  <TableHead className="text-purple-900 dark:text-purple-100 font-semibold">
                    Conversation
                  </TableHead>
                  <TableHead className="text-purple-900 dark:text-purple-100 font-semibold hidden sm:table-cell">
                    Model
                  </TableHead>
                  <TableHead className="text-purple-900 dark:text-purple-100 font-semibold hidden md:table-cell">
                    Last Updated
                  </TableHead>
                  <TableHead className="text-purple-900 dark:text-purple-100 font-semibold w-12 sm:w-16">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedThreads.map((thread: Thread) => (
                  <ThreadHistoryItem
                    key={thread._id}
                    thread={thread}
                    messageCount={threadMessageCounts.get(thread._id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent className="gap-1 sm:gap-2">
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                      className={`text-xs sm:text-sm px-2 sm:px-3 ${
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }`}
                    />
                  </PaginationItem>

                  {getPageNumbers().map((page, index) => (
                    <PaginationItem key={index}>
                      {page === "ellipsis" ? (
                        <PaginationEllipsis className="w-6 sm:w-8" />
                      ) : (
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer text-xs sm:text-sm w-6 h-6 sm:w-8 sm:h-8 p-0 flex items-center justify-center"
                        >
                          {page}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                      className={`text-xs sm:text-sm px-2 sm:px-3 ${
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }`}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
}
