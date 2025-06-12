import {
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";

import { genUploader } from "uploadthing/client";

import type { OurFileRouter } from "@/app/api/uploadthing/core";

// Generate the typed components
export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

// Generate the typed uploader hook
export const { uploadFiles } = genUploader<OurFileRouter>();
