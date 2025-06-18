import { useRef, useCallback } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { useFilePreview } from "@/lib/contexts/file-preview-context";

export interface AttachmentPreview {
  id: string;
  name: string;
  contentType: string;
  url: string;
  size: number;
  isUploading?: boolean;
}

export interface FileUploadHandlerParams {
  attachmentIds: string[];
  setAttachmentIds: React.Dispatch<React.SetStateAction<string[]>>;
  modelCapabilities?: {
    vision: boolean;
    multimodal: boolean;
  };
}

export interface FileUploadHandlerReturn {
  // File input ref and utilities
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  triggerFileSelect: (accept: string) => void;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  removeAttachment: (index: number) => void;

  // Upload state
  isUploading: boolean;

  // File preview data
  attachmentPreviews: AttachmentPreview[];
}

/**
 * Custom hook that manages file upload functionality including file selection,
 * validation, upload progress, and attachment state management
 */
export function useFileUploadHandler({
  attachmentIds,
  setAttachmentIds,
  modelCapabilities,
}: FileUploadHandlerParams): FileUploadHandlerReturn {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload hook from UploadThing with optimized settings
  const { startUpload, isUploading } = useUploadThing("chatAttachment", {
    onClientUploadComplete: (res) => {
      // Optional: Add global upload completion handler
      console.log("Upload completed:", res);
    },
    onUploadError: (error) => {
      console.error("Upload error:", error);
    },
  });

  // Use centralized file preview context
  const { addFilePreview, removeFilePreview, fileData } = useFilePreview();

  // Get current attachment previews from context - filtered by current attachmentIds
  const attachmentPreviews = Array.from(fileData.values()).filter((file) =>
    attachmentIds.includes(file.id),
  );

  // Utility to temporarily change accept attribute and open file picker
  const triggerFileSelect = useCallback((accept: string) => {
    const input = fileInputRef.current;
    if (!input) return;

    const previous = input.accept;
    input.accept = accept;
    input.click();
    // Restore immediately – the opened chooser keeps the filter
    input.accept = previous;
  }, []);

  // Handle file selection and upload
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      if (files.length === 0) return;

      // Filter for supported file types based on model capabilities
      const supportsImages =
        modelCapabilities?.vision || modelCapabilities?.multimodal;

      const supportedFiles = files.filter((file) => {
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        const isText = file.type.startsWith("text/");

        if (isImage && !supportsImages) {
          return false; // Filter out images if model doesn't support vision
        }

        return isImage || isPdf || isText;
      });

      if (supportedFiles.length !== files.length) {
        const rejectedFiles = files.filter((f) => !supportedFiles.includes(f));
        const hasImages = rejectedFiles.some((f) =>
          f.type.startsWith("image/"),
        );

        if (hasImages && !supportsImages) {
          alert(
            "Images are not supported by the current model. Only PDFs and text files are allowed.",
          );
        } else {
          alert("Only images, PDFs, and text files are supported.");
        }
      }

      if (supportedFiles.length > 0) {
        // Immediately show preview with loading state
        const immediatePreview = supportedFiles.map((file) => ({
          id: `temp-${Date.now()}-${Math.random()}`,
          name: file.name,
          contentType: file.type,
          url: URL.createObjectURL(file), // Create temporary URL for immediate preview
          size: file.size,
          isUploading: true, // Flag to show loading state
        }));

        // Add files to context and track their IDs
        immediatePreview.forEach((preview) => {
          addFilePreview(preview);
          setAttachmentIds((prev) => [...prev, preview.id]);
        });

        // Start upload and handle the promise
        startUpload(supportedFiles)
          .then((uploadedFiles) => {
            if (!uploadedFiles) return;

            const files = uploadedFiles as Array<{
              name: string;
              size: number;
              key: string;
              url: string; // Keep for backwards compatibility
              ufsUrl: string; // New preferred URL
              type?: string;
              // UploadThing v{>=9} places custom return values inside `serverData`
              // Older versions may return the fields at top level. We support both.
              serverData?: { attachmentId?: string | null } | null;
              attachmentId?: string | null;
            }>;

            // Collect all updates before applying them atomically
            const tempIdsToRemove: string[] = [];
            const newAttachmentIds: string[] = [];
            const finalFilesToAdd: Array<{
              tempId: string;
              finalData: {
                id: string;
                name: string;
                contentType: string;
                url: string;
                size: number;
              };
            }> = [];

            // Process all files first
            files.forEach((file, index) => {
              const tempId = immediatePreview[index]?.id;
              if (!tempId) return;

              console.log("[FileUploadHandler] Processing uploaded file:", {
                name: file.name,
                key: file.key,
                serverData: file.serverData,
                attachmentId: file.attachmentId,
                fullFile: file,
              });

              const resolvedAttachmentId =
                file.serverData?.attachmentId || // UploadThing v6+ with awaitServerData: true
                file.attachmentId || // Direct property (if returned by server)
                null;

              // Ignore file if the server did not return a Convex attachmentId
              if (!resolvedAttachmentId) {
                console.warn(
                  "[FileUploadHandler] UPLOAD_COMPLETE - No attachmentId returned for file, skipping linkage",
                  {
                    name: file.name,
                    key: file.key,
                    serverData: file.serverData,
                    attachmentId: file.attachmentId,
                    availableProperties: Object.keys(file),
                  },
                );
                // Still remove the temp preview
                tempIdsToRemove.push(tempId);
                return;
              }

              // Prepare final file data
              const finalFileData = {
                id: resolvedAttachmentId,
                name: file.name,
                contentType: (file.type ?? file.name).includes(".pdf")
                  ? "application/pdf"
                  : (file.type ?? "image/jpeg"),
                url: file.ufsUrl || file.url,
                size: file.size,
              };

              tempIdsToRemove.push(tempId);
              newAttachmentIds.push(resolvedAttachmentId);
              finalFilesToAdd.push({ tempId, finalData: finalFileData });
            });

            // Apply all updates atomically
            console.log("[FileUploadHandler] Processing upload completion:", {
              tempIdsToRemove,
              newAttachmentIds,
              finalFilesToAdd: finalFilesToAdd.map((f) => ({
                tempId: f.tempId,
                finalId: f.finalData.id,
              })),
            });

            // 1. Update attachment IDs in one go (remove temps, add finals)
            setAttachmentIds((prev) => {
              const filtered = prev.filter(
                (id) => !tempIdsToRemove.includes(id),
              );
              const newIds = [...filtered, ...newAttachmentIds];
              console.log("[FileUploadHandler] Updated attachment IDs:", {
                prev,
                filtered,
                newIds,
              });
              return newIds;
            });

            // 2. Update file previews (remove temps, add finals)
            finalFilesToAdd.forEach(({ tempId, finalData }) => {
              console.log("[FileUploadHandler] Replacing temp preview:", {
                tempId,
                finalId: finalData.id,
              });
              removeFilePreview(tempId); // This cleans up blob URLs
              addFilePreview(finalData);
            });

            // 3. Clean up any remaining temp IDs that didn't get processed
            tempIdsToRemove.forEach((tempId) => {
              if (!finalFilesToAdd.some((f) => f.tempId === tempId)) {
                console.log(
                  "[FileUploadHandler] Cleaning up orphaned temp ID:",
                  tempId,
                );
                removeFilePreview(tempId);
              }
            });

            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          })
          .catch((error) => {
            console.error(
              "[FileUploadHandler] UPLOAD_ERROR - Upload failed:",
              error,
            );
            // Clean up temporary previews on error
            immediatePreview.forEach((preview) => {
              // Clean up blob URL to prevent memory leaks
              if (preview.url.startsWith("blob:")) {
                URL.revokeObjectURL(preview.url);
              }
              removeFilePreview(preview.id);
              setAttachmentIds((prev) =>
                prev.filter((id) => id !== preview.id),
              );
            });
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          });
      }
    },
    [startUpload, addFilePreview, removeFilePreview, setAttachmentIds],
  );

  // Remove attachment by index
  const removeAttachment = useCallback(
    (index: number) => {
      // Get the file ID at the specified index
      const fileId = attachmentIds[index];
      if (fileId) {
        // Remove from context (this handles blob URL cleanup)
        removeFilePreview(fileId);
        // Remove from attachment IDs
        setAttachmentIds((prev) => prev.filter((_, i) => i !== index));
      }
    },
    [attachmentIds, removeFilePreview, setAttachmentIds],
  );

  return {
    // File input ref and utilities
    fileInputRef,
    triggerFileSelect,
    handleFileSelect,
    removeAttachment,

    // Upload state
    isUploading,

    // File preview data
    attachmentPreviews,
  };
}

/**
 * Utility function to validate if a file type is supported
 */
export function isSupportedFileType(
  file: File,
  modelCapabilities?: { vision: boolean; multimodal: boolean },
): boolean {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  const isText = file.type.startsWith("text/");

  const supportsImages =
    modelCapabilities?.vision || modelCapabilities?.multimodal;

  if (isImage && !supportsImages) {
    return false;
  }

  return isImage || isPdf || isText;
}

/**
 * Utility function to get supported file types for accept attribute
 */
export function getSupportedFileTypes(modelCapabilities?: {
  vision: boolean;
  multimodal: boolean;
}): string {
  const supportsImages =
    modelCapabilities?.vision || modelCapabilities?.multimodal;

  if (supportsImages) {
    return "image/*,application/pdf,text/*";
  } else {
    return "application/pdf,text/*";
  }
}

/**
 * Utility function to filter files by supported types
 */
export function filterSupportedFiles(
  files: File[],
  modelCapabilities?: { vision: boolean; multimodal: boolean },
): {
  supportedFiles: File[];
  hasUnsupportedFiles: boolean;
} {
  const supportedFiles = files.filter((file) =>
    isSupportedFileType(file, modelCapabilities),
  );
  const hasUnsupportedFiles = supportedFiles.length !== files.length;

  return {
    supportedFiles,
    hasUnsupportedFiles,
  };
}
