"use client";

import { useState } from "react";
import { uploadFiles } from "@/lib/uploadthing";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface UseFileUploadOptions {
  threadId?: Id<"threads">;
  messageId?: Id<"messages">;
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: Error) => void;
}

interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  key: string;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const upload = async (files: File[]) => {
    if (!files || files.length === 0) {
      toast.error("No files selected");
      return;
    }

    // Validate file sizes and types
    const maxSize = 64 * 1024 * 1024; // 64MB max for any file
    const invalidFiles = files.filter((file) => file.size > maxSize);

    if (invalidFiles.length > 0) {
      toast.error(
        `Files too large: ${invalidFiles.map((f) => f.name).join(", ")}`,
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadPromise = uploadFiles("chatAttachment", {
        files,
        onUploadProgress: ({ totalProgress }) => {
          setUploadProgress(totalProgress);
        },
      });

      // Show toast during upload
      toast.promise(uploadPromise, {
        loading: "Uploading files...",
        success: (data) => {
          const fileNames = data.map((f) => f.name).join(", ");
          return `Successfully uploaded: ${fileNames}`;
        },
        error: "Failed to upload files",
      });

      const uploadedFiles = await uploadPromise;

      // Transform the response to match our interface
      const transformedFiles: UploadedFile[] = uploadedFiles.map((file) => ({
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        key: file.key,
      }));

      // Call the completion callback
      options.onUploadComplete?.(transformedFiles);

      return transformedFiles;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";
      toast.error(errorMessage);
      options.onUploadError?.(
        error instanceof Error ? error : new Error(errorMessage),
      );
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return {
    upload,
    isUploading,
    uploadProgress,
  };
}
