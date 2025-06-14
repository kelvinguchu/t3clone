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

  // Calculate image dimensions based on count
  const getImageDimensions = () => {
    const count = images.length;
    if (count === 1)
      return { width: Math.min(400, maxHeight), height: maxHeight };
    if (count === 2)
      return { width: Math.min(200, maxHeight / 2), height: maxHeight / 2 };
    if (count <= 4)
      return { width: Math.min(150, maxHeight / 3), height: maxHeight / 3 };
    return { width: Math.min(120, maxHeight / 4), height: maxHeight / 4 };
  };

  const imageDimensions = getImageDimensions();

  return (
    <div className="mt-3 space-y-3">
      {/* Image Attachments */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            {images.length} image{images.length > 1 ? "s" : ""}
          </div>
          <div
            className="flex flex-wrap gap-2"
            style={{ maxHeight: `${maxHeight}px` }}
          >
            {images.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
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
                  unoptimized // For UploadThing URLs
                  onError={() => handleImageError(attachment.id)}
                />

                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-end">
                  <div className="w-full p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="flex items-center justify-between">
                      <div className="text-white text-xs font-medium truncate flex-1 mr-2">
                        {attachment.name}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-white hover:bg-white/20"
                          onClick={() => window.open(attachment.url, "_blank")}
                          title="Open in new tab"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-white hover:bg-white/20"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = attachment.url;
                            link.download = attachment.name;
                            link.click();
                          }}
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
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
        <div className="space-y-2">
          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
            {nonImages.length} file{nonImages.length > 1 ? "s" : ""}
          </div>
          <div className="space-y-2">
            {nonImages.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group"
              >
                {/* File Icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400">
                  {getFileIcon(attachment.contentType)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {attachment.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>{attachment.contentType}</span>
                    {attachment.size && (
                      <>
                        <span>•</span>
                        <span>{formatFileSize(attachment.size)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    onClick={() => window.open(attachment.url, "_blank")}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = attachment.url;
                      link.download = attachment.name;
                      link.click();
                    }}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
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
