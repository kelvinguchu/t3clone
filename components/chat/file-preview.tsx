"use client";

import { memo, useCallback } from "react";
import Image from "next/image";
import { X, FileText, File, Video, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFilePreview } from "@/lib/contexts/file-preview-context";

interface FilePreview {
  id: string;
  name: string;
  contentType: string;
  url: string;
  size?: number;
  isUploading?: boolean;
}

interface FilePreviewProps {
  files: FilePreview[];
  onRemove: (index: number) => void;
}

export const FilePreview = memo(
  function FilePreview({ files, onRemove }: Readonly<FilePreviewProps>) {
    const { getPreviewUrl } = useFilePreview();

    // Memoize utility functions to prevent recreation on every render
    const formatFileSize = useCallback((bytes: number) => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }, []);

    const getFileIcon = useCallback((contentType: string) => {
      if (contentType.startsWith("image/")) return null; // Will show image preview
      if (contentType.startsWith("video/"))
        return <Video className="h-4 w-4" />;
      if (contentType.startsWith("audio/"))
        return <Music className="h-4 w-4" />;
      if (contentType === "application/pdf")
        return <FileText className="h-4 w-4" />;
      return <File className="h-4 w-4" />;
    }, []);

    // Early return for empty files - after all hooks
    if (files.length === 0) {
      return null;
    }

    return (
      <div className="mx-auto w-full sm:w-[95%] md:w-[90%] lg:w-[80%] px-3 py-2 border-x-2 border-purple-300 dark:border-purple-700 bg-gradient-to-r from-purple-50/90 to-blue-50/90 dark:from-purple-950/30 dark:to-blue-950/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
            {files.length} file{files.length > 1 ? "s" : ""} attached
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {files.map((file, index) => {
            // Get the preview URL from context, fallback to file.url
            const previewUrl = getPreviewUrl(file.id) ?? file.url;

            return (
              <div
                key={file.id}
                className="relative group flex items-center gap-2 px-2 py-1.5 bg-white dark:bg-purple-800/80 rounded-lg border border-purple-200 dark:border-purple-600 shadow-sm hover:shadow-md transition-all duration-200 max-w-48"
              >
                {/* File Preview/Icon */}
                <div className="flex-shrink-0 relative">
                  {file.contentType.startsWith("image/") ? (
                    <div className="relative w-8 h-8 rounded overflow-hidden">
                      <Image
                        src={previewUrl}
                        alt={file.name}
                        fill
                        sizes="32px"
                        className="object-cover"
                        unoptimized // For UploadThing URLs and blob URLs
                      />
                      {file.isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-700 flex items-center justify-center text-purple-600 dark:text-purple-300 relative">
                      {getFileIcon(file.contentType)}
                      {file.isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                          <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-purple-800 dark:text-purple-200 truncate">
                    {file.name}
                  </div>
                  {file.size && (
                    <div className="text-xs text-purple-600 dark:text-purple-400">
                      {formatFileSize(file.size)}
                    </div>
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full"
                  title="Remove file"
                >
                  <X className="h-3 w-3 text-red-500" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if files array length or content changes
    if (prevProps.files.length !== nextProps.files.length) {
      return false; // Re-render
    }

    // Check if file IDs are the same (shallow comparison)
    for (let i = 0; i < prevProps.files.length; i++) {
      if (prevProps.files[i].id !== nextProps.files[i].id) {
        return false; // Re-render
      }
    }

    // onRemove function comparison (should be stable with useCallback)
    return prevProps.onRemove === nextProps.onRemove; // Don't re-render if same
  },
);
