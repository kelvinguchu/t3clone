import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createStandaloneAttachment = mutation({
  args: {
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
    fileUrl: v.string(),
    fileKey: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    // Create attachment record without threadId (will be linked later when used in chat)
    const attachmentId = await ctx.db.insert("attachments", {
      // threadId is optional - will be set when file is used in a thread
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.fileType,
      fileUrl: args.fileUrl,
      fileKey: args.fileKey,
      status: "processed",
      createdAt: Date.now(),
    });

    return attachmentId;
  },
});

// Create a new attachment record for a specific thread
export const createAttachment = mutation({
  args: {
    threadId: v.id("threads"), // Required to match schema
    messageId: v.optional(v.id("messages")),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(), // MIME type
    fileUrl: v.string(),
    fileKey: v.string(),
    uploadedBy: v.string(), // Clerk user ID
  },
  handler: async (ctx, args) => {
    // Create attachment record
    const attachmentId = await ctx.db.insert("attachments", {
      threadId: args.threadId,
      messageId: args.messageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.fileType,
      fileUrl: args.fileUrl,
      fileKey: args.fileKey,
      status: "processed",
      createdAt: Date.now(),
    });

    return attachmentId;
  },
});

// Get attachments for a thread
export const getThreadAttachments = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    return attachments;
  },
});

// Get attachments for a specific message
export const getMessageAttachments = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    return attachments;
  },
});

// Get a specific attachment by ID
export const getAttachment = query({
  args: {
    attachmentId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    return attachment;
  },
});

// Delete an attachment
export const deleteAttachment = mutation({
  args: {
    attachmentId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new Error("Attachment not found");
    }

    await ctx.db.delete(args.attachmentId);
    return { success: true };
  },
});

// Update attachment status (useful for processing states)
export const updateAttachmentStatus = mutation({
  args: {
    attachmentId: v.id("attachments"),
    status: v.union(
      v.literal("uploading"),
      v.literal("processed"),
      v.literal("error"),
    ),
    extractedText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new Error("Attachment not found");
    }

    await ctx.db.patch(args.attachmentId, {
      status: args.status,
      extractedText: args.extractedText,
    });

    return { success: true };
  },
});

// Associate an attachment with a message (useful for chat context)
export const attachToMessage = mutation({
  args: {
    attachmentId: v.id("attachments"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new Error("Attachment not found");
    }

    await ctx.db.patch(args.attachmentId, {
      messageId: args.messageId,
    });

    return { success: true };
  },
});

// Link a standalone attachment to a thread (when used in chat)
export const linkAttachmentToThread = mutation({
  args: {
    attachmentId: v.id("attachments"),
    threadId: v.id("threads"),
    messageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new Error("Attachment not found");
    }

    // Update the attachment to link it to the thread and optionally message
    await ctx.db.patch(args.attachmentId, {
      threadId: args.threadId,
      messageId: args.messageId,
    });

    return { success: true };
  },
});

// Get standalone attachments (not linked to any thread)
export const getStandaloneAttachments = query({
  args: {},
  handler: async (ctx) => {
    // Get all attachments without a threadId
    const attachments = await ctx.db
      .query("attachments")
      .filter((q) => q.eq(q.field("threadId"), undefined))
      .collect();

    return attachments;
  },
});
