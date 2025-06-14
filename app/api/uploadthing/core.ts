import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { currentUser } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Chat attachments route - supports images, documents, and other files
  chatAttachment: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 5,
      acl: "public-read",
    },
    pdf: {
      maxFileSize: "16MB",
      maxFileCount: 3,
      acl: "public-read",
    },
    text: {
      maxFileSize: "4MB",
      maxFileCount: 5,
      acl: "public-read",
    },
    video: {
      maxFileSize: "64MB",
      maxFileCount: 2,
      acl: "public-read",
    },
    audio: {
      maxFileSize: "32MB",
      maxFileCount: 3,
      acl: "public-read",
    },
  })
    .middleware(async () => {
      // Get authenticated user from Clerk
      const user = await currentUser();

      // Allow anonymous uploads but track differently
      if (!user) {
        // For anonymous users, we'll use a session-based approach
        return {
          userId: null,
          userEmail: null,
          isAnonymous: true,
        };
      }

      // Return metadata to be used in onUploadComplete
      return {
        userId: user.id,
        userEmail: user.emailAddresses[0]?.emailAddress,
        isAnonymous: false,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code runs on your server after upload

      let attachmentId: string | null = null;

      try {
        // Store file metadata in Convex as standalone attachment
        // This will be linked to a thread/message later when used in chat
        if (metadata.userId) {
          // Authenticated user
          attachmentId = await fetchMutation(
            api.attachments.createStandaloneAttachment,
            {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileUrl: file.ufsUrl,
              fileKey: file.key,
              uploadedBy: metadata.userId,
            },
          );
        } else {
          // Anonymous user - create attachment without userId
          attachmentId = await fetchMutation(
            api.attachments.createStandaloneAttachment,
            {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileUrl: file.ufsUrl,
              fileKey: file.key,
              // Don't include uploadedBy for anonymous users
            },
          );
        }
      } catch (error) {
        console.error("Failed to create Convex attachment:", error);
        // Don't throw here to avoid breaking the upload flow
        // The file is already uploaded to UploadThing
      }

      // Return data to be sent to the client, including the Convex attachment ID
      return {
        uploadedBy: metadata.userId,
        fileUrl: file.ufsUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        attachmentId, // Include the Convex attachment ID
      };
    }),

  // Profile picture upload route
  profilePicture: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const user = await currentUser();

      if (!user) {
        throw new UploadThingError(
          "You must be logged in to upload a profile picture",
        );
      }

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code runs on your server after upload

      return { uploadedBy: metadata.userId, profilePicture: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
