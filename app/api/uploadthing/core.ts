import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { currentUser } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

const f = createUploadthing();

// UploadThing file router configuration for chat attachments and profile pictures
export const ourFileRouter = {
  // Chat attachments with multi-format support and size limits
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
      awaitServerData: true,
    },
  )
    .middleware(async () => {
      // Authenticate user and prepare upload metadata
      try {
        const user = await currentUser();

        // Allow anonymous uploads with session tracking
        if (!user) {
          return {
            userId: null,
            userEmail: null,
            isAnonymous: true,
          };
        }

        // Return authenticated user metadata
        return {
          userId: user.id,
          userEmail: user.emailAddresses[0]?.emailAddress,
          isAnonymous: false,
        };
      } catch {
        throw new UploadThingError("Authentication failed");
      }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Store file metadata in Convex database after successful upload
      let attachmentId: string | null = null;

      try {
        if (metadata.userId) {
          // Create attachment record for authenticated user
          attachmentId = await fetchMutation(
            api.attachments.createStandaloneAttachment,
            {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileUrl: file.ufsUrl || file.url,
              fileKey: file.key,
              uploadedBy: metadata.userId,
            },
          );
        } else {
          // Create attachment record for anonymous user
          attachmentId = await fetchMutation(
            api.attachments.createStandaloneAttachment,
            {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              fileUrl: file.ufsUrl || file.url,
              fileKey: file.key,
            },
          );
        }
      } catch {
        // Continue without attachment ID if database save fails
      }

      // Return upload result with attachment metadata
      return {
        uploadedBy: metadata.userId,
        fileUrl: file.ufsUrl || file.url,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        attachmentId,
      };
    }),

  // Profile picture upload for authenticated users only
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
      // Return profile picture URL for authenticated user
      return {
        uploadedBy: metadata.userId,
        profilePicture: file.ufsUrl || file.url,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
