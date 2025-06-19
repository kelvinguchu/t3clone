"use client";

import { useState } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Share2,
  Copy,
  Eye,
  Users,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
} from "lucide-react";
import { useThreadShare } from "@/lib/actions/chat/chat-sidebar/thread-share-handler";
import { Id } from "@/convex/_generated/dataModel";

interface SharedThread {
  _id: string;
  title: string;
  shareToken?: string;
  shareExpiresAt?: number;
  shareMetadata?: {
    viewCount: number;
    lastViewed: number;
  };
  cloneCount?: number;
  allowCloning?: boolean;
}

interface ThreadActionsProps {
  thread: SharedThread;
  onUpdate: () => void;
}

function ThreadActions({ thread, onUpdate }: ThreadActionsProps) {
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { actions } = useThreadShare({
    threadId: thread._id as Id<"threads">,
    threadTitle: thread.title,
    isAnonymous: false,
    currentlyPublic: true,
    currentShareToken: thread.shareToken,
  });

  const handleMakePrivate = async () => {
    setIsProcessing(true);
    try {
      await actions.toggleShare(); // This will make it private since it's currently public
      onUpdate(); // Refresh the list
      setShowRevokeDialog(false);
    } catch (error) {
      console.error("Failed to make thread private:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleCloning = async () => {
    setIsProcessing(true);
    try {
      await actions.updateCloningSettings(!thread.allowCloning);
      onUpdate(); // Refresh the list
    } catch (error) {
      console.error("Failed to update cloning settings:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isExpired = thread.shareExpiresAt && thread.shareExpiresAt < Date.now();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            disabled={isProcessing}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-white dark:bg-dark-bg-secondary border-purple-200 dark:border-purple-800"
        >
          <DropdownMenuItem
            onClick={() => window.open(`/chat/${thread._id}`, "_blank")}
            className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Thread
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-purple-200 dark:bg-purple-800" />

          <DropdownMenuItem
            onClick={handleToggleCloning}
            disabled={isExpired || isProcessing}
            className="focus:bg-purple-50 dark:focus:bg-purple-900/20"
          >
            {thread.allowCloning ? (
              <>
                <UserX className="h-4 w-4 mr-2" />
                Disable Cloning
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Enable Cloning
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-purple-200 dark:bg-purple-800" />

          <DropdownMenuItem
            onClick={() => setShowRevokeDialog(true)}
            disabled={isProcessing}
            className="focus:bg-red-50 dark:focus:bg-red-900/20 text-red-600 dark:text-red-400"
          >
            <ShieldOff className="h-4 w-4 mr-2" />
            Make Private
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make Thread Private</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to make &ldquo;{thread.title}&rdquo;
              private? This will revoke the share link and make the conversation
              inaccessible to anyone who previously had the link.
              <br />
              <br />
              <strong>This action cannot be undone.</strong> You can share the
              thread again later, but it will have a new share link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMakePrivate}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            >
              {isProcessing ? "Making Private..." : "Make Private"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function SharedThreadsManager() {
  const { user } = useUser();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Get all shared threads for the user
  const sharedThreads = useQuery(
    api.threads.getUserSharedThreads,
    user?.id ? { userId: user.id } : "skip",
  );

  // Force refresh function - Convex queries automatically update when data changes
  const handleUpdate = () => {
    // No explicit refresh needed - Convex reactive queries handle this automatically
  };

  // Pagination calculations
  const totalItems = sharedThreads?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedThreads = sharedThreads?.slice(startIndex, endIndex) || [];

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

  const handleCopyUrl = async (shareToken: string) => {
    const shareUrl = `${window.location.origin}/share/${shareToken}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setCopiedUrl(shareToken);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error("Failed to copy share URL:", error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) {
    return (
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 sm:p-6 lg:p-8 text-center border border-purple-200/60 dark:border-purple-800/50">
        <AlertCircle className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
        <h3 className="text-base sm:text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
          Authentication Required
        </h3>
        <p className="text-sm sm:text-base text-purple-700 dark:text-purple-300">
          Please sign in to view your shared conversations.
        </p>
      </div>
    );
  }

  if (!sharedThreads) {
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

  if (totalItems === 0) {
    return (
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 sm:p-6 lg:p-8 text-center border border-purple-200/60 dark:border-purple-800/50">
        <Share2 className="h-12 w-12 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
        <h3 className="text-base sm:text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
          No shared conversations yet
        </h3>
        <p className="text-sm sm:text-base text-purple-700 dark:text-purple-300">
          Share a conversation from the chat sidebar to see it here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-purple-900 dark:text-purple-100">
            Shared Conversations
          </h2>
          <p className="text-purple-700 dark:text-purple-300 text-xs sm:text-sm">
            {totalItems > 0 ? (
              <>
                Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of{" "}
                {totalItems} shared conversation{totalItems !== 1 ? "s" : ""}
              </>
            ) : (
              "0 shared conversations"
            )}
          </p>
        </div>
      </div>

      {/* Desktop table view */}
      <div className="border border-purple-200/60 dark:border-purple-800/50 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-50 dark:hover:bg-purple-900/20">
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold">
                Conversation
              </TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold hidden sm:table-cell">
                Share URL
              </TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold text-center hidden md:table-cell">
                Views
              </TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold text-center hidden md:table-cell">
                Clones
              </TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold hidden lg:table-cell">
                Status
              </TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold w-16 sm:w-20">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedThreads.map((thread) => {
              const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${thread.shareToken}`;
              const isExpired =
                thread.shareExpiresAt && thread.shareExpiresAt < Date.now();
              const isCopied = copiedUrl === thread.shareToken;

              return (
                <TableRow
                  key={thread._id}
                  className="bg-white dark:bg-dark-bg-secondary hover:bg-purple-50 dark:hover:bg-purple-900/10"
                >
                  <TableCell className="p-2 sm:p-4">
                    <div className="min-w-0">
                      <h3 className="font-medium text-purple-900 dark:text-purple-100 text-sm sm:text-base truncate">
                        {thread.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 sm:hidden">
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          {shareUrl.length > 30
                            ? `${shareUrl.substring(0, 30)}...`
                            : shareUrl}
                        </span>
                        <Button
                          onClick={() => handleCopyUrl(thread.shareToken!)}
                          size="sm"
                          variant="outline"
                          className="shrink-0 h-6 w-6 p-0 border-purple-200 dark:border-purple-800"
                        >
                          {isCopied ? (
                            <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <div className="flex items-center gap-4 mt-1 md:hidden">
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs font-medium text-purple-900 dark:text-purple-100">
                            {thread.shareMetadata?.viewCount || 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs font-medium text-purple-900 dark:text-purple-100">
                            {thread.cloneCount || 0}
                          </span>
                        </div>
                        <Badge
                          variant={isExpired ? "destructive" : "secondary"}
                          className={`text-xs ${isExpired ? "" : "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200"}`}
                        >
                          {isExpired ? "Expired" : "Active"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {thread.allowCloning && !isExpired && (
                          <Badge
                            variant="outline"
                            className="text-xs border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20"
                          >
                            <Users className="h-3 w-3 mr-1" />
                            Cloning Enabled
                          </Badge>
                        )}
                        {isExpired && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Expired
                          </Badge>
                        )}
                      </div>
                      {thread.shareMetadata?.lastViewed && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 lg:hidden">
                          Last viewed:{" "}
                          {formatDate(thread.shareMetadata.lastViewed)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4 hidden sm:table-cell">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={shareUrl}
                          readOnly
                          className="font-mono text-xs bg-purple-50 dark:bg-dark-bg-tertiary border-purple-200 dark:border-purple-800 flex-1"
                        />
                        <Button
                          onClick={() => handleCopyUrl(thread.shareToken!)}
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        >
                          {isCopied ? (
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {isCopied && (
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Link copied!
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4 text-center hidden md:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-semibold text-purple-900 dark:text-purple-100">
                        {thread.shareMetadata?.viewCount || 0}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4 text-center hidden md:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-semibold text-purple-900 dark:text-purple-100">
                        {thread.cloneCount || 0}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4 hidden lg:table-cell">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isExpired ? "destructive" : "secondary"}
                          className={
                            isExpired
                              ? ""
                              : "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                          }
                        >
                          {isExpired ? "Expired" : "Active"}
                        </Badge>
                        {thread.allowCloning && !isExpired && (
                          <Badge
                            variant="outline"
                            className="text-xs border-purple-200 dark:border-purple-800"
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            Cloning
                          </Badge>
                        )}
                      </div>
                      {thread.shareExpiresAt && (
                        <div className="text-xs text-purple-600 dark:text-purple-400">
                          {isExpired ? "Expired" : "Expires"}{" "}
                          {formatDate(thread.shareExpiresAt)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        onClick={() => handleCopyUrl(thread.shareToken!)}
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 md:hidden"
                      >
                        {isCopied ? (
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>

                      <ThreadActions thread={thread} onUpdate={handleUpdate} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
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
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
    </div>
  );
}
