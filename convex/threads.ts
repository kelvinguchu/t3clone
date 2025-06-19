import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

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
      // Return null instead of throwing error to handle race conditions
      // when thread is deleted while query is executing
      return null;
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
    allowCloning: v.optional(v.boolean()), // New parameter for cloning control
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
      allowCloning?: boolean;
      shareMetadata?: {
        viewCount: number;
        lastViewed: number;
        allowedViewers?: string[];
      };
    } = {
      isPublic: args.isPublic,
      updatedAt: Date.now(),
    };

    if (args.isPublic) {
      // Only generate a new share token if the thread is not already public
      if (!thread.isPublic || !thread.shareToken) {
        updates.shareToken = crypto.randomUUID();

        // Initialize share metadata for new shares
        updates.shareMetadata = {
          viewCount: 0,
          lastViewed: Date.now(),
        };
      } else {
        // Keep existing token and metadata when just updating settings
        updates.shareToken = thread.shareToken;
        updates.shareMetadata = thread.shareMetadata;
      }

      // Set cloning permission (default to true if not specified)
      updates.allowCloning = args.allowCloning ?? true;

      if (args.expiresInHours) {
        updates.shareExpiresAt =
          Date.now() + args.expiresInHours * 60 * 60 * 1000;
      }
    } else {
      // Remove share settings
      updates.shareToken = undefined;
      updates.shareExpiresAt = undefined;
      updates.allowCloning = undefined;
      updates.shareMetadata = undefined;
    }

    await ctx.db.patch(args.threadId, updates);

    return args.isPublic ? updates.shareToken : null;
  },
});

// Get shared thread by token with view tracking (public access)
export const getSharedThreadWithTracking = query({
  args: {
    shareToken: v.string(),
    viewerId: v.optional(v.string()), // Clerk user ID if authenticated
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .unique();

    if (!thread) {
      return null;
    }

    // Check if share has expired
    if (thread.shareExpiresAt && thread.shareExpiresAt < Date.now()) {
      return null;
    }

    if (!thread.isPublic) {
      return null;
    }

    return thread;
  },
});

// Track a view of a shared thread (mutation for updating view count)
export const trackShareView = mutation({
  args: {
    shareToken: v.string(),
    viewerId: v.optional(v.string()), // Clerk user ID if authenticated
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .unique();

    if (!thread || !thread.isPublic) {
      // Silently fail for invalid threads to prevent tracking attacks
      return;
    }

    // Update view count and last viewed
    const currentMetadata = thread.shareMetadata || {
      viewCount: 0,
      lastViewed: Date.now(),
    };
    await ctx.db.patch(thread._id, {
      shareMetadata: {
        ...currentMetadata,
        viewCount: currentMetadata.viewCount + 1,
        lastViewed: Date.now(),
      },
    });
  },
});

// Check if user has already cloned a shared thread
export const checkExistingClone = query({
  args: {
    shareToken: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Get the original thread
    const originalThread = await ctx.db
      .query("threads")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .unique();

    if (!originalThread) {
      return null;
    }

    // Check if user has already cloned this thread using compound index
    const existingClone = await ctx.db
      .query("threads")
      .withIndex("by_user_original", (q) =>
        q
          .eq("userId", identity.subject)
          .eq("originalThreadId", originalThread._id),
      )
      .unique();

    return existingClone ? existingClone._id : null;
  },
});

// Clone a shared thread for authenticated users
export const cloneSharedThread = mutation({
  args: {
    shareToken: v.string(),
    newTitle: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()), // Optional idempotency key for request deduplication
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required to clone threads");
    }

    // Get the original thread
    const originalThread = await ctx.db
      .query("threads")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .unique();

    if (!originalThread || !originalThread.isPublic) {
      throw new Error("Thread not found or not public");
    }

    // Check if share has expired
    if (
      originalThread.shareExpiresAt &&
      originalThread.shareExpiresAt < Date.now()
    ) {
      throw new Error("Shared thread has expired");
    }

    // Check if cloning is allowed
    if (originalThread.allowCloning === false) {
      throw new Error("Cloning is not allowed for this thread");
    }

    // Use the compound index to check for existing clone
    const existingClone = await ctx.db
      .query("threads")
      .withIndex("by_user_original", (q) =>
        q
          .eq("userId", identity.subject)
          .eq("originalThreadId", originalThread._id),
      )
      .unique();

    if (existingClone) {
      // Return the existing clone ID instead of creating a new one
      return existingClone._id;
    }

    const now = Date.now();

    try {
      // Create cloned thread
      const clonedThreadId = await ctx.db.insert("threads", {
        title: args.newTitle || `${originalThread.title} (Copy)`,
        userId: identity.subject,
        model: originalThread.model,
        systemPrompt: originalThread.systemPrompt,
        originalThreadId: originalThread._id,
        isAnonymous: false,
        createdAt: now,
        updatedAt: now,
      });

      // Clone all messages
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", originalThread._id))
        .order("asc")
        .collect();

      for (const message of messages) {
        await ctx.db.insert("messages", {
          threadId: clonedThreadId,
          role: message.role,
          content: message.content,
          reasoning: message.reasoning,
          parentId: undefined,
          order: message.order,
          model: message.model,
          tokenCount: message.tokenCount,
          finishReason: message.finishReason,
          toolsUsed: message.toolsUsed,
          hasToolCalls: message.hasToolCalls,
          cloned: true,
          createdAt: message.createdAt,
          updatedAt: now,
        });
      }

      // Update clone count on original thread
      await ctx.db.patch(originalThread._id, {
        cloneCount: (originalThread.cloneCount || 0) + 1,
      });

      return clonedThreadId;
    } catch (error) {
      // If there's a race condition and another clone was created simultaneously,
      // check again for the existing clone and return it
      const raceConditionClone = await ctx.db
        .query("threads")
        .withIndex("by_user_original", (q) =>
          q
            .eq("userId", identity.subject)
            .eq("originalThreadId", originalThread._id),
        )
        .unique();

      if (raceConditionClone) {
        return raceConditionClone._id;
      }

      // If it's a different error, re-throw it
      throw error;
    }
  },
});

// Cleanup duplicate clones (admin function to fix existing duplicates)
export const cleanupDuplicateClones = mutation({
  args: {
    originalThreadId: v.id("threads"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Find all clones of this thread by this user
    const clones = await ctx.db
      .query("threads")
      .withIndex("by_user_original", (q) =>
        q
          .eq("userId", args.userId)
          .eq("originalThreadId", args.originalThreadId),
      )
      .collect();

    if (clones.length <= 1) {
      return { message: "No duplicates found", deletedCount: 0 };
    }

    // Keep the oldest clone (first created) and delete the rest
    const sortedClones = clones.sort(
      (a, b) => a._creationTime - b._creationTime,
    );
    const clonesToDelete = sortedClones.slice(1); // Remove first (oldest) element

    let deletedCount = 0;

    for (const clone of clonesToDelete) {
      // Delete messages associated with this clone
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", clone._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete attachments associated with this clone
      const attachments = await ctx.db
        .query("attachments")
        .withIndex("by_thread", (q) => q.eq("threadId", clone._id))
        .collect();

      for (const attachment of attachments) {
        await ctx.db.delete(attachment._id);
      }

      // Delete the clone thread
      await ctx.db.delete(clone._id);
      deletedCount++;
    }

    return {
      message: `Cleaned up ${deletedCount} duplicate clones, kept the original clone`,
      deletedCount,
      keptCloneId: sortedClones[0]._id,
    };
  },
});

// Get thread statistics for thread owners
export const getThreadStats = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.subject) {
      throw new Error("Thread not found or unauthorized");
    }

    // Get clone count by querying cloned threads
    const clones = await ctx.db
      .query("threads")
      .withIndex("by_original_thread", (q) =>
        q.eq("originalThreadId", args.threadId),
      )
      .collect();

    return {
      viewCount: thread.shareMetadata?.viewCount || 0,
      cloneCount: thread.cloneCount || 0,
      lastViewed: thread.shareMetadata?.lastViewed,
      isPublic: thread.isPublic || false,
      shareToken: thread.shareToken,
      shareExpiresAt: thread.shareExpiresAt,
      allowCloning: thread.allowCloning !== false, // Default to true
      clonesCount: clones.length, // Verification count from actual clones
    };
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

// PAGINATED VERSIONS FOR INFINITE SCROLLING

// Get paginated threads for a user (authenticated users only)
export const getUserThreadsPaginated = query({
  args: {
    userId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Use the by_user index and order by updatedAt (desc), then _creationTime (desc)
    const result = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Sort the page results to handle bulk updates properly
    const sortedPage = result.page.sort((a, b) => {
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

    return {
      ...result,
      page: sortedPage,
    };
  },
});

// Get paginated threads for anonymous session
export const getAnonymousThreadsPaginated = query({
  args: {
    sessionId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    // Use the by_session index and filter for anonymous threads
    const result = await ctx.db
      .query("threads")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("isAnonymous"), true))
      .order("desc")
      .paginate(args.paginationOpts);

    // Sort the page results to handle bulk updates properly
    const sortedPage = result.page.sort((a, b) => {
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

    return {
      ...result,
      page: sortedPage,
    };
  },
});

// Get all shared threads for a user (for settings/history page)
export const getUserSharedThreads = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const sharedThreads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .collect();

    // Sort by most recently shared first
    return sharedThreads.sort((a, b) => {
      const aTime = a.updatedAt ?? a._creationTime;
      const bTime = b.updatedAt ?? b._creationTime;
      return bTime - aTime;
    });
  },
});
