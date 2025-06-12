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
    },
    pdf: {
      maxFileSize: "16MB",
      maxFileCount: 3,
    },
    text: {
      maxFileSize: "4MB",
      maxFileCount: 5,
    },
    video: {
      maxFileSize: "64MB",
      maxFileCount: 2,
    },
    audio: {
      maxFileSize: "32MB",
      maxFileCount: 3,
    },
  })
    .middleware(async () => {
      // Get authenticated user from Clerk
      const user = await currentUser();

      // Throw if user isn't signed in
      if (!user) {
        throw new UploadThingError("You must be logged in to upload files");
      }

      // Return metadata to be used in onUploadComplete
      return {
        userId: user.id,
        userEmail: user.emailAddresses[0]?.emailAddress,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code runs on your server after upload
      console.log("Upload complete for userId:", metadata.userId);
      console.log("File URL:", file.ufsUrl);
      console.log("File details:", {
        name: file.name,
        size: file.size,
        type: file.type,
        key: file.key,
      });

      try {
        // Store file metadata in Convex as standalone attachment
        // This will be linked to a thread/message later when used in chat
        await fetchMutation(api.attachments.createStandaloneAttachment, {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileUrl: file.ufsUrl,
          fileKey: file.key,
          uploadedBy: metadata.userId,
        });

        console.log("File metadata stored in Convex successfully");
      } catch (error) {
        console.error("Failed to store file metadata in Convex:", error);
        // Don't throw here to avoid breaking the upload flow
        // The file is already uploaded to UploadThing
      }

      // Return data to be sent to the client
      return {
        uploadedBy: metadata.userId,
        fileUrl: file.ufsUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
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
      console.log(
        "Profile picture upload complete for userId:",
        metadata.userId,
      );
      console.log("File URL:", file.ufsUrl);

      return { uploadedBy: metadata.userId, profilePicture: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
