import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { currentUser } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  // Chat attachments route - supports images, documents, and other files
  chatAttachment: f(
    {
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
    },
    {
      awaitServerData: true, // Wait for server callback to get attachmentId
    },
  )
    .middleware(async ({ req }) => {
      console.log("[UploadThing] Middleware called:", {
        method: req.method,
        url: req.url,
        headers: Object.fromEntries(req.headers.entries()),
      });

      try {
        // Get authenticated user from Clerk
        const user = await currentUser();

        // Allow anonymous uploads but track differently
        if (!user) {
          console.log("[UploadThing] Anonymous upload detected");
          // For anonymous users, we'll use a session-based approach
          return {
            userId: null,
            userEmail: null,
            isAnonymous: true,
          };
        }

        console.log("[UploadThing] Authenticated upload:", {
          userId: user.id,
          email: user.emailAddresses[0]?.emailAddress,
        });

        // Return metadata to be used in onUploadComplete
        return {
          userId: user.id,
          userEmail: user.emailAddresses[0]?.emailAddress,
          isAnonymous: false,
        };
      } catch (error) {
        console.error("[UploadThing] Middleware error:", error);
        throw new UploadThingError("Authentication failed");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code runs on your server after upload
      console.log("[UploadThing] onUploadComplete called:", {
        metadata,
        file: {
          name: file.name,
          size: file.size,
          type: file.type,
          key: file.key,
          url: file.url,
          ufsUrl: file.ufsUrl,
        },
      });

      let attachmentId: string | null = null;

      try {
        // Store file metadata in Convex as standalone attachment
        // This will be linked to a thread/message later when used in chat
        if (metadata.userId) {
          // Authenticated user
          console.log(
            "[UploadThing] Creating Convex attachment for authenticated user",
          );
          attachmentId = await fetchMutation(
            api.attachments.createStandaloneAttachment,
            {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileUrl: file.ufsUrl || file.url, // Prefer ufsUrl
              fileKey: file.key,
              uploadedBy: metadata.userId,
            },
          );
        } else {
          // Anonymous user - create attachment without userId
          console.log(
            "[UploadThing] Creating Convex attachment for anonymous user",
          );
          attachmentId = await fetchMutation(
            api.attachments.createStandaloneAttachment,
            {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileUrl: file.ufsUrl || file.url, // Prefer ufsUrl
              fileKey: file.key,
              // Don't include uploadedBy for anonymous users
            },
          );
        }

        console.log("[UploadThing] Convex attachment created:", {
          attachmentId,
        });
      } catch (error) {
        console.error(
          "[UploadThing] Failed to create Convex attachment:",
          error,
        );
        // Don't throw here to avoid breaking the upload flow
        // The file is already uploaded to UploadThing
        // But we should still return some indication of the error
      }

      const result = {
        uploadedBy: metadata.userId,
        fileUrl: file.ufsUrl || file.url, // Prefer ufsUrl
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        attachmentId, // Include the Convex attachment ID
      };

      console.log("[UploadThing] onUploadComplete returning:", result);

      // Return data to be sent to the client, including the Convex attachment ID
      return result;
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

      return {
        uploadedBy: metadata.userId,
        profilePicture: file.ufsUrl || file.url,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
