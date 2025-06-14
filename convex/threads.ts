import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all threads for a user (authenticated users only)
export const getUserThreads = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by updatedAt first, then by _creationTime as tiebreaker (both descending)
    return threads.sort((a, b) => {
      const aTime = a.updatedAt ?? a._creationTime;
      const bTime = b.updatedAt ?? b._creationTime;

      // Check if multiple threads have the same updatedAt (bulk update indicator)
      const timeDiff = Math.abs(aTime - bTime);
      if (timeDiff < 1000) {
        // Within 1 second = likely bulk update
        // For bulk updates, sort by creation time to maintain natural order
        return b._creationTime - a._creationTime;
      }

      // Primary sort by updatedAt/creationTime
      if (bTime !== aTime) {
        return bTime - aTime;
      }

      // Secondary sort by _creationTime (most recent first) when updatedAt is identical
      return b._creationTime - a._creationTime;
    });
  },
});

// Get threads for anonymous session
export const getAnonymousThreads = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("isAnonymous"), true))
      .collect();

    // Sort by updatedAt first, then by _creationTime as tiebreaker (both descending)
    return threads.sort((a, b) => {
      const aTime = a.updatedAt ?? a._creationTime;
      const bTime = b.updatedAt ?? b._creationTime;

      // Check if multiple threads have the same updatedAt (bulk update indicator)
      const timeDiff = Math.abs(aTime - bTime);
      if (timeDiff < 1000) {
        // Within 1 second = likely bulk update
        // For bulk updates, sort by creation time to maintain natural order
        return b._creationTime - a._creationTime;
      }

      // Primary sort by updatedAt/creationTime
      if (bTime !== aTime) {
        return bTime - aTime;
      }

      // Secondary sort by _creationTime (most recent first) when updatedAt is identical
      return b._creationTime - a._creationTime;
    });
  },
});

// Get a specific thread (supports both authenticated and anonymous access)
export const getThread = query({
  args: {
    threadId: v.id("threads"),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const identity = await ctx.auth.getUserIdentity();

    // Check access permissions
    if (thread.isAnonymous && args.sessionId) {
      // Anonymous thread access - check session ID
      if (thread.sessionId !== args.sessionId) {
        throw new Error("Unauthorized");
      }
    } else if (thread.userId) {
      // Authenticated user thread - check user ownership or if it's public
      if (thread.userId !== identity?.subject && !thread.isPublic) {
        throw new Error("Unauthorized");
      }
    } else {
      throw new Error("Invalid thread access");
    }

    return thread;
  },
});

// Create a new thread (authenticated users)
export const createThread = mutation({
  args: {
    title: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    const threadId = await ctx.db.insert("threads", {
      title: args.title,
      userId: identity.subject,
      model: args.model,
      isAnonymous: false,
      createdAt: now,
      updatedAt: now,
    });

    return threadId;
  },
});

// Create a new anonymous thread
export const createAnonymousThread = mutation({
  args: {
    title: v.string(),
    model: v.string(),
    sessionId: v.string(),
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const threadId = await ctx.db.insert("threads", {
      title: args.title,
      sessionId: args.sessionId,
      ...(args.ipHash ? { ipHash: args.ipHash } : {}),
      isAnonymous: true,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    });

    return threadId;
  },
});

// Update thread metadata (supports both authenticated and anonymous)
export const updateThread = mutation({
  args: {
    threadId: v.id("threads"),
    sessionId: v.optional(v.string()), // For anonymous access
    title: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const identity = await ctx.auth.getUserIdentity();

    // Check authorization
    if (thread.isAnonymous) {
      if (!args.sessionId || thread.sessionId !== args.sessionId) {
        throw new Error("Unauthorized");
      }
    } else if (!identity || thread.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const updates: {
      updatedAt: number;
      title?: string;
      model?: string;
    } = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.model !== undefined) updates.model = args.model;

    await ctx.db.patch(args.threadId, updates);
  },
});

// Delete a thread and all its messages (supports both authenticated and anonymous)
export const deleteThread = mutation({
  args: {
    threadId: v.id("threads"),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const identity = await ctx.auth.getUserIdentity();

    // Check authorization
    if (thread.isAnonymous) {
      if (!args.sessionId || thread.sessionId !== args.sessionId) {
        throw new Error("Unauthorized");
      }
    } else if (!identity || thread.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    // Delete all messages in this thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete all attachments in this thread
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const attachment of attachments) {
      await ctx.db.delete(attachment._id);
    }

    // Delete the thread
    await ctx.db.delete(args.threadId);
  },
});

// Share/unshare a thread (authenticated users only)
export const toggleThreadShare = mutation({
  args: {
    threadId: v.id("threads"),
    isPublic: v.boolean(),
    expiresInHours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.subject || thread.isAnonymous) {
      throw new Error(
        "Thread not found, unauthorized, or anonymous threads cannot be shared",
      );
    }

    const updates: {
      isPublic: boolean;
      updatedAt: number;
      shareToken?: string;
      shareExpiresAt?: number;
    } = {
      isPublic: args.isPublic,
      updatedAt: Date.now(),
    };

    if (args.isPublic) {
      // Generate share token
      updates.shareToken = crypto.randomUUID();

      if (args.expiresInHours) {
        updates.shareExpiresAt =
          Date.now() + args.expiresInHours * 60 * 60 * 1000;
      }
    } else {
      // Remove share settings
      updates.shareToken = undefined;
      updates.shareExpiresAt = undefined;
    }

    await ctx.db.patch(args.threadId, updates);

    return args.isPublic ? updates.shareToken : null;
  },
});

// Get shared thread by token (public access)
export const getSharedThread = query({
  args: {
    shareToken: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .unique();

    if (!thread) {
      throw new Error("Shared thread not found");
    }

    // Check if share has expired
    if (thread.shareExpiresAt && thread.shareExpiresAt < Date.now()) {
      throw new Error("Shared thread has expired");
    }

    if (!thread.isPublic) {
      throw new Error("Thread is no longer public");
    }

    return thread;
  },
});

// Get thread count for anonymous session (for UI purposes)
export const getAnonymousThreadCount = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("isAnonymous"), true))
      .collect();

    return threads.length;
  },
});

// Cleanup anonymous threads for expired sessions (internal function)
export const cleanupAnonymousThreads = mutation({
  args: {
    sessionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let deletedCount = 0;

    for (const sessionId of args.sessionIds) {
      const threads = await ctx.db
        .query("threads")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .collect();

      for (const thread of threads) {
        // Delete messages
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
          .collect();

        for (const message of messages) {
          await ctx.db.delete(message._id);
        }

        // Delete attachments
        const attachments = await ctx.db
          .query("attachments")
          .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
          .collect();

        for (const attachment of attachments) {
          await ctx.db.delete(attachment._id);
        }

        // Delete thread
        await ctx.db.delete(thread._id);
        deletedCount++;
      }
    }

    return { deletedThreads: deletedCount };
  },
});

// Create a branched thread by cloning messages up to a specific message
export const branchThread = mutation({
  args: {
    sourceThreadId: v.id("threads"),
    branchFromMessageId: v.id("messages"),
    model: v.string(),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    // Validate source thread
    const sourceThread = await ctx.db.get(args.sourceThreadId);
    if (!sourceThread) {
      throw new Error("Source thread not found");
    }

    const identity = await ctx.auth.getUserIdentity();

    // Authorization – same rules as updateThread
    if (sourceThread.isAnonymous) {
      if (!args.sessionId || sourceThread.sessionId !== args.sessionId) {
        throw new Error("Unauthorized");
      }
    } else if (!identity || sourceThread.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    // Verify branch message belongs to the source thread
    const branchMessage = await ctx.db.get(args.branchFromMessageId);
    if (!branchMessage || branchMessage.threadId !== args.sourceThreadId) {
      throw new Error("Branch message does not belong to source thread");
    }

    const now = Date.now();

    // Create the new thread with reference to parent
    const newThreadId = await ctx.db.insert("threads", {
      title: sourceThread.title,
      userId: sourceThread.userId,
      sessionId: sourceThread.sessionId,
      isAnonymous: sourceThread.isAnonymous,
      model: args.model,
      systemPrompt: sourceThread.systemPrompt,
      parentThreadId: args.sourceThreadId,
      branchFromMessageId: args.branchFromMessageId,
      createdAt: now,
      updatedAt: now,
    });

    // Copy messages up to and including the branch message order
    const cutoffOrder = branchMessage.order;

    const messagesToCopy = await ctx.db
      .query("messages")
      .withIndex("by_thread_order", (q) =>
        q.eq("threadId", args.sourceThreadId),
      )
      .filter((q) => q.lte(q.field("order"), cutoffOrder))
      .order("asc")
      .collect();

    for (const m of messagesToCopy) {
      await ctx.db.insert("messages", {
        threadId: newThreadId,
        role: m.role,
        content: m.content,
        parentId: undefined,
        order: m.order,
        model: m.model,
        tokenCount: m.tokenCount,
        finishReason: m.finishReason,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        cloned: true,
      });
    }

    // Return new thread ID to client
    return newThreadId;
  },
});

// Claim anonymous threads after user signs up/logs in
export const claimAnonymousThreads = mutation({
  args: {
    sessionId: v.string(),
    ipHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Fetch all anonymous threads linked to sessionId
    const threadsBySession = await ctx.db
      .query("threads")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Optionally, also fetch by ipHash to capture related sessions
    let threadsByIp: typeof threadsBySession = [];
    if (args.ipHash) {
      threadsByIp = await ctx.db
        .query("threads")
        .withIndex("by_ip_hash", (q) => q.eq("ipHash", args.ipHash))
        .collect();
    }

    const threads = [...threadsBySession, ...threadsByIp];

    for (const thread of threads) {
      await ctx.db.patch(thread._id, {
        userId: identity.subject,
        isAnonymous: false,
        // Keep sessionId so anonymous session stats retain message count across sign-in/out
        // sessionId: undefined,
        ipHash: undefined,
        // Don't update updatedAt during migration to preserve natural order
        // updatedAt: Date.now(),
      });
    }

    // Deduplicate thread IDs and return count
    const uniqueCount = Array.from(new Set(threads.map((t) => t._id))).length;
    return { migrated: uniqueCount };
  },
});
