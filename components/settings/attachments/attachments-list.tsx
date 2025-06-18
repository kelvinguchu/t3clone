"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Image,
  FileText,
  Download,
  Trash2,
  ExternalLink,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface Attachment {
  _id: Id<"attachments">;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  fileKey: string;
  status: "uploading" | "processed" | "error";
  createdAt: number;
  extractedText?: string;
}

interface AttachmentsListProps {
  attachments: Attachment[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function AttachmentsList({
  attachments,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: AttachmentsListProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const deleteAttachment = useMutation(api.attachments.deleteAttachment);

  // Helper functions
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return Image;
    if (mimeType.includes("pdf")) return FileText;
    return FileText;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processed":
        return "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200";
      case "uploading":
        return "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200";
      case "error":
        return "bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200";
      default:
        return "bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200";
    }
  };

  const handleDelete = async (attachmentId: Id<"attachments">) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    setDeletingIds((prev) => new Set(prev).add(attachmentId));
    try {
      await deleteAttachment({ attachmentId });
    } catch (error) {
      console.error("Failed to delete attachment:", error);
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(attachmentId);
        return newSet;
      });
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, "_blank");
  };

  const handleView = (url: string) => {
    window.open(url, "_blank");
  };

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

  if (attachments.length === 0) {
    return (
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 sm:p-6 lg:p-8 text-center border border-purple-200/60 dark:border-purple-800/50">
        <h3 className="text-base sm:text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
          No Attachments
        </h3>
        <p className="text-sm sm:text-base text-purple-700 dark:text-purple-300">
          You haven&apos;t uploaded any files yet. PDFs and images uploaded in
          chat will appear here.
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
            Your Attachments
          </h2>
          <p className="text-purple-700 dark:text-purple-300 text-xs sm:text-sm">
            {totalItems} file{totalItems !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      {/* Attachments Table */}
      <div className="border border-purple-200/60 dark:border-purple-800/50 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-50 dark:hover:bg-purple-900/20">
              <TableHead className="w-12 sm:w-16"></TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold">
                File
              </TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold hidden sm:table-cell">
                Size
              </TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold hidden md:table-cell">
                Status
              </TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold hidden lg:table-cell">
                Date
              </TableHead>
              <TableHead className="text-purple-900 dark:text-purple-100 font-semibold w-12 sm:w-16">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.mimeType);
              const formattedDate = new Date(
                attachment.createdAt,
              ).toLocaleDateString();
              const isDeleting = deletingIds.has(attachment._id);

              return (
                <TableRow
                  key={attachment._id}
                  className="bg-white dark:bg-dark-bg-secondary hover:bg-purple-50 dark:hover:bg-purple-900/10"
                >
                  <TableCell className="p-2 sm:p-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 dark:bg-dark-bg-tertiary rounded-lg flex items-center justify-center">
                      <FileIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-purple-900 dark:text-purple-100 text-sm sm:text-base truncate">
                        {attachment.fileName}
                      </p>
                      <div className="flex items-center gap-2 mt-1 sm:hidden">
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          {formatFileSize(attachment.fileSize)}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${getStatusColor(attachment.status)}`}
                        >
                          {attachment.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 lg:hidden">
                        {formattedDate}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4 hidden sm:table-cell">
                    <span className="text-sm text-purple-600 dark:text-purple-400">
                      {formatFileSize(attachment.fileSize)}
                    </span>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4 hidden md:table-cell">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getStatusColor(attachment.status)}`}
                    >
                      {attachment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4 hidden lg:table-cell">
                    <span className="text-sm text-purple-600 dark:text-purple-400">
                      {formattedDate}
                    </span>
                  </TableCell>
                  <TableCell className="p-2 sm:p-4">
                    <div className="flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => handleView(attachment.fileUrl)}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDownload(attachment.fileUrl)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(attachment._id)}
                            disabled={isDeleting}
                            className="text-red-600 dark:text-red-400"
                          >
                            {isDeleting ? (
                              <div className="mr-2 h-4 w-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
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
                      onClick={() => onPageChange(page)}
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
                    onPageChange(Math.min(totalPages, currentPage + 1))
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
