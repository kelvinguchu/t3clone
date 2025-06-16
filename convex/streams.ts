import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Add a new stream ID for a chat
export const appendStreamId = mutation({
  args: {
    chatId: v.string(),
    streamId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("streams", {
      chatId: args.chatId,
      streamId: args.streamId,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

// Load all stream IDs for a chat
export const loadStreams = query({
  args: {
    chatId: v.string(),
  },
  handler: async (ctx, args) => {
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .collect();

    return streams.map((stream) => stream.streamId);
  },
});

// Mark a stream as completed
export const completeStream = mutation({
  args: {
    streamId: v.string(),
  },
  handler: async (ctx, args) => {
    const stream = await ctx.db
      .query("streams")
      .withIndex("by_stream", (q) => q.eq("streamId", args.streamId))
      .unique();

    if (stream) {
      await ctx.db.patch(stream._id, {
        status: "completed",
        completedAt: Date.now(),
      });
    }
  },
});

// Mark a stream as error
export const errorStream = mutation({
  args: {
    streamId: v.string(),
  },
  handler: async (ctx, args) => {
    const stream = await ctx.db
      .query("streams")
      .withIndex("by_stream", (q) => q.eq("streamId", args.streamId))
      .unique();

    if (stream) {
      await ctx.db.patch(stream._id, {
        status: "error",
        completedAt: Date.now(),
      });
    }
  },
});

// Get messages by chat ID (for resumable streams)
export const getMessagesByChatId = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    // Convert string ID to Convex ID
    const threadId = args.id as Id<"threads">; // We'll need to handle this properly

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .collect();

    return messages.map((msg) => ({
      id: msg._id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    }));
  },
}); 