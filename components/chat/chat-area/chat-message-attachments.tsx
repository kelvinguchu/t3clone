"use client";

import Image from "next/image";
import {
  FileText,
  File,
  Video,
  Music,
  Download,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useFilePreview } from "@/lib/contexts/file-preview-context";

interface MessageAttachment {
  id: string;
  name: string;
  contentType: string;
  url: string;
  size?: number;
}

interface ChatMessageAttachmentsProps {
  attachments: MessageAttachment[];
  maxHeight?: number; // Maximum height in pixels for the attachment area
}

export function ChatMessageAttachments({
  attachments,
  maxHeight = 300,
}: Readonly<ChatMessageAttachmentsProps>) {
  const { getPreviewUrl } = useFilePreview();
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  if (attachments.length === 0) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("video/")) return <Video className="h-5 w-5" />;
    if (contentType.startsWith("audio/")) return <Music className="h-5 w-5" />;
    if (contentType === "application/pdf")
      return <FileText className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  const handleImageError = (attachmentId: string) => {
    setImageErrors((prev) => new Set([...prev, attachmentId]));
  };

  const images = attachments.filter(
    (att) => att.contentType.startsWith("image/") && !imageErrors.has(att.id),
  );
  const nonImages = attachments.filter(
    (att) => !att.contentType.startsWith("image/") || imageErrors.has(att.id),
  );

  // Calculate image dimensions based on count and screen size
  const getImageDimensions = () => {
    const count = images.length;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

    if (count === 1) {
      const maxWidth = isMobile
        ? Math.min(280, maxHeight)
        : Math.min(400, maxHeight);
      return {
        width: maxWidth,
        height: Math.min(maxHeight, isMobile ? 200 : maxHeight),
      };
    }
    if (count === 2) {
      const width = isMobile
        ? Math.min(140, maxHeight / 2)
        : Math.min(200, maxHeight / 2);
      return {
        width,
        height: Math.min(maxHeight / 2, isMobile ? 120 : maxHeight / 2),
      };
    }
    if (count <= 4) {
      const width = isMobile
        ? Math.min(100, maxHeight / 3)
        : Math.min(150, maxHeight / 3);
      return {
        width,
        height: Math.min(maxHeight / 3, isMobile ? 100 : maxHeight / 3),
      };
    }
    const width = isMobile
      ? Math.min(80, maxHeight / 4)
      : Math.min(120, maxHeight / 4);
    return {
      width,
      height: Math.min(maxHeight / 4, isMobile ? 80 : maxHeight / 4),
    };
  };

  const imageDimensions = getImageDimensions();

  return (
    <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
      {/* Image Attachments */}
      {images.length > 0 && (
        <div className="space-y-1.5 sm:space-y-2">
          <div className="text-xs text-gray-600 dark:text-slate-400 font-medium">
            {images.length} image{images.length > 1 ? "s" : ""}
          </div>
          <div
            className="flex flex-wrap gap-1.5 sm:gap-2"
            style={{ maxHeight: `${maxHeight}px` }}
          >
            {images.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-dark-purple-accent/50 hover:border-gray-300 dark:hover:border-dark-purple-accent transition-all duration-200"
                style={{
                  width: `${imageDimensions.width}px`,
                  height: `${imageDimensions.height}px`,
                }}
              >
                <Image
                  src={getPreviewUrl(attachment.id) ?? attachment.url}
                  alt={attachment.name}
                  fill
                  sizes={`${imageDimensions.width}px`}
                  className="object-cover"
                  priority={false}
                  quality={85}
                  onError={() => handleImageError(attachment.id)}
                />

                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-end">
                  <div className="w-full p-1.5 sm:p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="flex items-center justify-between">
                      <div className="text-white text-xs font-medium truncate flex-1 mr-1 sm:mr-2">
                        {attachment.name}
                      </div>
                      <div className="flex gap-0.5 sm:gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 sm:h-6 sm:w-6 text-white hover:bg-white/20"
                          onClick={() => window.open(attachment.url, "_blank")}
                          title="Open in new tab"
                        >
                          <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 sm:h-6 sm:w-6 text-white hover:bg-white/20"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = attachment.url;
                            link.download = attachment.name;
                            link.click();
                          }}
                          title="Download"
                        >
                          <Download className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-Image Attachments */}
      {nonImages.length > 0 && (
        <div className="space-y-1.5 sm:space-y-2">
          <div className="text-xs text-gray-600 dark:text-slate-400 font-medium">
            {nonImages.length} file{nonImages.length > 1 ? "s" : ""}
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            {nonImages.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 dark:bg-dark-bg-tertiary/30 rounded-lg border border-gray-200 dark:border-dark-purple-accent/30 hover:border-gray-300 dark:hover:border-dark-purple-accent transition-all duration-200 group"
              >
                {/* File Icon */}
                <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-100 dark:bg-dark-bg-secondary flex items-center justify-center text-gray-600 dark:text-slate-400">
                  {getFileIcon(attachment.contentType)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-slate-200 truncate">
                    {attachment.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 sm:gap-2">
                    <span className="truncate">{attachment.contentType}</span>
                    {attachment.size && (
                      <>
                        <span>•</span>
                        <span>{formatFileSize(attachment.size)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                    onClick={() => window.open(attachment.url, "_blank")}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = attachment.url;
                      link.download = attachment.name;
                      link.click();
                    }}
                    title="Download"
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
