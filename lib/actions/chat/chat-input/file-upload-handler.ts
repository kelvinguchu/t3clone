import { useRef, useCallback, useState } from "react";
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

export interface FileUploadError {
  title: string;
  message: string;
  type: "unsupported_files" | "model_incompatible" | "upload_error";
}

export interface FileUploadHandlerParams {
  attachmentIds: string[];
  setAttachmentIds: React.Dispatch<React.SetStateAction<string[]>>;
  modelCapabilities?: {
    vision: boolean;
    multimodal: boolean;
    fileAttachments: boolean;
  };
  onError?: (error: FileUploadError) => void;
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

  // Error state
  error: FileUploadError | null;
  clearError: () => void;
}

// Manage file upload with validation, progress tracking, and attachment state
export function useFileUploadHandler({
  attachmentIds,
  setAttachmentIds,
  modelCapabilities,
  onError,
}: FileUploadHandlerParams): FileUploadHandlerReturn {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<FileUploadError | null>(null);

  // Configure UploadThing with error handling
  const { startUpload, isUploading } = useUploadThing("chatAttachment", {
    onClientUploadComplete: () => {},
    onUploadError: () => {
      const uploadError: FileUploadError = {
        title: "Upload Failed",
        message: "Failed to upload files. Please try again.",
        type: "upload_error",
      };
      setError(uploadError);
      onError?.(uploadError);
    },
  });

  const { addFilePreview, removeFilePreview, fileData } = useFilePreview();

  // Filter file previews by current attachment IDs
  const attachmentPreviews = Array.from(fileData.values()).filter((file) =>
    attachmentIds.includes(file.id),
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Open file picker with temporary accept filter
  const triggerFileSelect = useCallback((accept: string) => {
    const input = fileInputRef.current;
    if (!input) return;

    const previous = input.accept;
    input.accept = accept;
    input.click();
    input.accept = previous;
  }, []);

  // Process file selection, validate, and start upload
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      if (files.length === 0) return;

      clearError();

      // Validate model supports file attachments
      if (!modelCapabilities?.fileAttachments) {
        const noAttachmentsError: FileUploadError = {
          title: "File Attachments Not Supported",
          message:
            "The current model does not support file attachments. Please switch to a model that supports file uploads.",
          type: "model_incompatible",
        };
        setError(noAttachmentsError);
        onError?.(noAttachmentsError);
        return;
      }

      // Filter files by model capabilities
      const supportsImages =
        modelCapabilities?.vision || modelCapabilities?.multimodal;

      const supportedFiles = files.filter((file) => {
        const isImage = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";
        const isText = file.type.startsWith("text/");

        if (isImage && !supportsImages) {
          return false;
        }

        return isImage || isPdf || isText;
      });

      // Handle unsupported files
      if (supportedFiles.length !== files.length) {
        const rejectedFiles = files.filter((f) => !supportedFiles.includes(f));
        const hasImages = rejectedFiles.some((f) =>
          f.type.startsWith("image/"),
        );

        let errorMessage: string;
        if (hasImages && !supportsImages) {
          errorMessage =
            "Images are not supported by the current model. Please switch to a model that supports image files, or upload only PDFs and text files.";
        } else {
          errorMessage =
            "Some files are not supported. Only images, PDFs, and text files are allowed.";
        }

        const unsupportedError: FileUploadError = {
          title: "Unsupported File Types",
          message: errorMessage,
          type: "unsupported_files",
        };
        setError(unsupportedError);
        onError?.(unsupportedError);

        if (supportedFiles.length === 0) {
          return;
        }
      }

      if (supportedFiles.length > 0) {
        // Create immediate previews with loading state
        const immediatePreview = supportedFiles.map((file) => ({
          id: `temp-${Date.now()}-${Math.random()}`,
          name: file.name,
          contentType: file.type,
          url: URL.createObjectURL(file),
          size: file.size,
          isUploading: true,
        }));

        // Add previews to context and track IDs
        immediatePreview.forEach((preview) => {
          addFilePreview(preview);
          setAttachmentIds((prev) => [...prev, preview.id]);
        });

        // Upload files and handle completion
        startUpload(supportedFiles)
          .then((uploadedFiles) => {
            if (!uploadedFiles) return;

            const files = uploadedFiles as Array<{
              name: string;
              size: number;
              key: string;
              url: string;
              ufsUrl: string;
              type?: string;
              serverData?: { attachmentId?: string | null } | null;
              attachmentId?: string | null;
            }>;

            // Prepare batch updates for atomic state changes
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

            // Process uploaded files and extract attachment IDs
            files.forEach((file, index) => {
              const tempId = immediatePreview[index]?.id;
              if (!tempId) return;

              const resolvedAttachmentId =
                file.serverData?.attachmentId || file.attachmentId || null;

              if (!resolvedAttachmentId) {
                tempIdsToRemove.push(tempId);
                return;
              }

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

            // Apply all state updates atomically
            setAttachmentIds((prev) => {
              const filtered = prev.filter(
                (id) => !tempIdsToRemove.includes(id),
              );
              return [...filtered, ...newAttachmentIds];
            });

            // Replace temporary previews with final file data
            finalFilesToAdd.forEach(({ tempId, finalData }) => {
              removeFilePreview(tempId);
              addFilePreview(finalData);
            });

            // Clean up orphaned temporary previews
            tempIdsToRemove.forEach((tempId) => {
              if (!finalFilesToAdd.some((f) => f.tempId === tempId)) {
                removeFilePreview(tempId);
              }
            });

            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          })
          .catch(() => {
            const uploadError: FileUploadError = {
              title: "Upload Failed",
              message: "Failed to upload files. Please try again.",
              type: "upload_error",
            };
            setError(uploadError);
            onError?.(uploadError);

            // Clean up temporary previews on upload failure
            immediatePreview.forEach((preview) => {
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
    [
      startUpload,
      addFilePreview,
      removeFilePreview,
      setAttachmentIds,
      modelCapabilities,
      clearError,
      onError,
    ],
  );

  // Remove attachment by index
  const removeAttachment = useCallback(
    (index: number) => {
      const fileId = attachmentIds[index];
      if (fileId) {
        removeFilePreview(fileId);
        setAttachmentIds((prev) => prev.filter((_, i) => i !== index));
      }
    },
    [attachmentIds, removeFilePreview, setAttachmentIds],
  );

  return {
    fileInputRef,
    triggerFileSelect,
    handleFileSelect,
    removeAttachment,
    isUploading,
    attachmentPreviews,
    error,
    clearError,
  };
}

// Validate if file type is supported by model capabilities
export function isSupportedFileType(
  file: File,
  modelCapabilities?: {
    vision: boolean;
    multimodal: boolean;
    fileAttachments: boolean;
  },
): boolean {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  const isText = file.type.startsWith("text/");

  if (!modelCapabilities?.fileAttachments) {
    return false;
  }

  const supportsImages =
    modelCapabilities?.vision || modelCapabilities?.multimodal;

  if (isImage && !supportsImages) {
    return false;
  }

  return isImage || isPdf || isText;
}

// Get file accept string based on model capabilities
export function getSupportedFileTypes(modelCapabilities?: {
  vision: boolean;
  multimodal: boolean;
  fileAttachments: boolean;
}): string {
  if (!modelCapabilities?.fileAttachments) {
    return "";
  }

  const supportsImages =
    modelCapabilities?.vision || modelCapabilities?.multimodal;

  if (supportsImages) {
    return "image/*,application/pdf,text/*";
  } else {
    return "application/pdf,text/*";
  }
}

// Filter files array by supported types
export function filterSupportedFiles(
  files: File[],
  modelCapabilities?: {
    vision: boolean;
    multimodal: boolean;
    fileAttachments: boolean;
  },
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
