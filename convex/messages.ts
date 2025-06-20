import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Get all messages for a thread (supports both authenticated and anonymous access)
export const getThreadMessages = query({
  args: {
    threadId: v.id("threads"),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    // First check if user has access to this thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return null;
    }

    const identity = await ctx.auth.getUserIdentity();

    // Check access permissions
    if (thread.userId) {
      if (thread.userId !== identity?.subject) {
        console.error("Unauthorized: User mismatch", {
          threadUserId: thread.userId,
          identitySubject: identity?.subject,
        });
        return null; // Return null instead of throwing
      }
    } else if (thread.isAnonymous && thread.sessionId) {
      if (thread.sessionId !== args.sessionId) {
        console.warn("Unauthorized: Session mismatch", {
          threadSessionId: thread.sessionId,
          argsSessionId: args.sessionId,
        });
        return null; // Return null to trigger client-side transfer
      }
    } else if (!thread.userId) {
      // Unclaimed thread with no session, deny access
      return null;
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

// Get recent messages for a thread (limited for context injection)
export const getRecentThreadMessages = query({
  args: {
    threadId: v.id("threads"),
    sessionId: v.optional(v.string()), // For anonymous access
    limit: v.optional(v.number()), // Default to 10 messages
  },
  handler: async (ctx, args) => {
    // First check if user has access to this thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return null;
    }

    const identity = await ctx.auth.getUserIdentity();

    // Check access permissions
    if (thread.userId) {
      if (thread.userId !== identity?.subject) {
        return null; // Return null instead of throwing
      }
    } else if (thread.isAnonymous && thread.sessionId) {
      if (thread.sessionId !== args.sessionId) {
        return null; // Return null instead of throwing
      }
    } else if (!thread.userId) {
      // Unclaimed thread with no session, deny access
      return null;
    }

    const limit = args.limit ?? 10; // Default to 10 recent messages

    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc") // Get most recent first
      .take(limit)
      .then((messages) => messages.reverse()); // Reverse to get chronological order
  },
});

// Get all messages for a thread with their attachments (supports both authenticated and anonymous access)
export const getThreadMessagesWithAttachments = query({
  args: {
    threadId: v.id("threads"),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    console.log("[getThreadMessagesWithAttachments] Starting query", {
      threadId: args.threadId,
      sessionId: args.sessionId,
      hasSessionId: !!args.sessionId,
    });

    // First check if user has access to this thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      console.log("[getThreadMessagesWithAttachments] Thread not found", {
        threadId: args.threadId,
      });
      // Return null instead of throwing error to handle race conditions
      // when thread is deleted while query is executing
      return null;
    }

    const identity = await ctx.auth.getUserIdentity();
    console.log(
      "[getThreadMessagesWithAttachments] Thread and identity loaded",
      {
        threadId: args.threadId,
        threadUserId: thread.userId,
        threadSessionId: thread.sessionId,
        threadIsAnonymous: thread.isAnonymous,
        identitySubject: identity?.subject,
        argsSessionId: args.sessionId,
        hasIdentity: !!identity,
      },
    );

    // Enhanced access control with proper migration handling
    // Priority order:
    // 1. Authenticated user access (thread.userId matches identity)
    // 2. Claimed thread access (thread has userId but user is still passing sessionId during transition)
    // 3. Anonymous session access (thread.sessionId matches args.sessionId)

    if (thread.userId && identity?.subject) {
      // Case 1: Both thread and user are authenticated
      console.log(
        "[getThreadMessagesWithAttachments] Checking authenticated user access",
        {
          threadUserId: thread.userId,
          identitySubject: identity.subject,
          match: thread.userId === identity.subject,
        },
      );

      if (thread.userId === identity.subject) {
        // Perfect match - authenticated user accessing their thread
        console.log(
          "[getThreadMessagesWithAttachments] Authenticated access granted",
        );
      } else {
        console.error("[getThreadMessagesWithAttachments] User mismatch", {
          threadUserId: thread.userId,
          identitySubject: identity.subject,
        });
        throw new Error("Unauthorized: User mismatch");
      }
    } else if (
      thread.userId &&
      !identity?.subject &&
      thread.sessionId === args.sessionId
    ) {
      // Case 2: Claimed thread but user identity hasn't propagated yet
      // This handles the race condition during claiming
      console.warn(
        "[getThreadMessagesWithAttachments] Claimed thread access during identity propagation",
        {
          threadUserId: thread.userId,
          threadSessionId: thread.sessionId,
          argsSessionId: args.sessionId,
        },
      );
      // Allow access - this is the race condition fix from the threads.ts getThread query
    } else if (thread.sessionId && args.sessionId) {
      // Case 3: Anonymous session access
      console.log(
        "[getThreadMessagesWithAttachments] Checking session access",
        {
          threadSessionId: thread.sessionId,
          argsSessionId: args.sessionId,
          threadIsAnonymous: thread.isAnonymous,
          hasIdentity: !!identity,
          sessionMatch: thread.sessionId === args.sessionId,
        },
      );

      if (thread.sessionId === args.sessionId) {
        console.log(
          "[getThreadMessagesWithAttachments] Session access granted",
        );
      } else {
        console.warn(
          "[getThreadMessagesWithAttachments] Anonymous session mismatch detected",
          {
            threadSessionId: thread.sessionId,
            argsSessionId: args.sessionId,
            threadIsAnonymous: thread.isAnonymous,
            hasIdentity: !!identity,
          },
        );

        // For anonymous threads with session mismatch, deny access to trigger client-side transfer
        if (thread.isAnonymous && args.sessionId) {
          console.warn(
            "[getThreadMessagesWithAttachments] Session mismatch - denying access to trigger transfer",
            {
              threadSessionId: thread.sessionId,
              argsSessionId: args.sessionId,
            },
          );
          return null; // Deny access to trigger background transfer
        } else {
          console.error(
            "[getThreadMessagesWithAttachments] Cannot provide access to thread",
          );
          return null;
        }
      }
    } else {
      console.log(
        "[getThreadMessagesWithAttachments] Thread has no valid access path, returning empty array",
        {
          hasThreadUserId: !!thread.userId,
          hasThreadSessionId: !!thread.sessionId,
          hasIdentity: !!identity,
          hasArgsSessionId: !!args.sessionId,
        },
      );
      // Thread is likely being created, return empty array to prevent crash
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();

    // Fetch attachments for each message
    const messagesWithAttachments = await Promise.all(
      messages.map(async (message) => {
        const attachments = await ctx.db
          .query("attachments")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();

        return {
          ...message,
          attachments: attachments.map((att) => ({
            id: att._id,
            name: att.fileName,
            contentType: att.mimeType,
            url: att.fileUrl,
            size: att.fileSize,
          })),
        };
      }),
    );

    return messagesWithAttachments;
  },
});

// Get messages in a specific branch (for branching conversations)
export const getBranchMessages = query({
  args: {
    threadId: v.id("threads"),
    parentId: v.optional(v.id("messages")),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    // First check if user has access to this thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return null; // Return null instead of throwing
    }

    const identity = await ctx.auth.getUserIdentity();

    // Check access permissions
    if (thread.userId) {
      if (thread.userId !== identity?.subject) {
        return null; // Return null instead of throwing
      }
    } else if (thread.isAnonymous && thread.sessionId) {
      if (thread.sessionId !== args.sessionId) {
        return null; // Return null instead of throwing
      }
    } else if (!thread.userId) {
      // Unclaimed thread with no session, deny access
      return null;
    }

    // Get all messages in this branch
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) =>
        args.parentId
          ? q.eq("parentId", args.parentId)
          : q.eq("parentId", undefined),
      )
      .filter((q) => q.eq(q.field("threadId"), args.threadId))
      .order("asc")
      .collect();

    return messages;
  },
});

// Add a new message to a thread (supports both authenticated and anonymous)
export const addMessage = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),
    reasoning: v.optional(v.string()), // Reasoning/thinking tokens from AI models
    sessionId: v.optional(v.string()), // For anonymous access
    parentId: v.optional(v.id("messages")),
    model: v.optional(v.string()),
    tokenCount: v.optional(v.number()),
    finishReason: v.optional(v.string()),
    // Tool usage tracking
    toolsUsed: v.optional(v.array(v.string())),
    hasToolCalls: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check thread ownership/access
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const identity = await ctx.auth.getUserIdentity();

    // If the thread was created anonymously but the user is now authenticated and
    // still possesses the original session, "claim" the thread by promoting it
    // to the authenticated user. This lets users seamlessly continue chatting
    // after signing in without triggering authorization errors.
    if (
      thread.isAnonymous &&
      identity &&
      (!args.sessionId || thread.sessionId === args.sessionId)
    ) {
      await ctx.db.patch(args.threadId, {
        isAnonymous: false,
        userId: identity.subject,
        updatedAt: Date.now(),
      });
      // Reflect the promotion locally so the authorization check below passes
      thread.isAnonymous = false;
      thread.userId = identity.subject;
    }

    // Check authorization
    if (thread.isAnonymous) {
      // Still anonymous after potential promotion – must match session
      if (!args.sessionId || thread.sessionId !== args.sessionId) {
        throw new Error("Unauthorized");
      }
    } else if (!identity || thread.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    // Calculate order for this message
    const existingMessages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    const maxOrder = Math.max(0, ...existingMessages.map((m) => m.order));
    const now = Date.now();

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      reasoning: args.reasoning,
      parentId: args.parentId,
      order: maxOrder + 1,
      model: args.model,
      tokenCount: args.tokenCount,
      finishReason: args.finishReason,
      toolsUsed: args.toolsUsed,
      hasToolCalls: args.hasToolCalls,
      createdAt: now,
      updatedAt: now,
    });

    // Update thread's updatedAt timestamp
    await ctx.db.patch(args.threadId, {
      updatedAt: now,
    });

    return messageId;
  },
});

// Update message content (for streaming updates - supports both authenticated and anonymous)
export const updateMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    reasoning: v.optional(v.string()), // Reasoning/thinking tokens from AI models
    sessionId: v.optional(v.string()), // For anonymous access
    isStreaming: v.optional(v.boolean()),
    tokenCount: v.optional(v.number()),
    finishReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check thread ownership/access
    const thread = await ctx.db.get(message.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const identity = await ctx.auth.getUserIdentity();

    // Seamless promotion of anonymous threads once the user authenticates.
    if (
      thread.isAnonymous &&
      identity &&
      (!args.sessionId || thread.sessionId === args.sessionId)
    ) {
      await ctx.db.patch(message.threadId, {
        isAnonymous: false,
        userId: identity.subject,
        updatedAt: Date.now(),
      });
      thread.isAnonymous = false;
      thread.userId = identity.subject;
    }

    // Check authorization
    if (thread.isAnonymous) {
      if (!args.sessionId || thread.sessionId !== args.sessionId) {
        throw new Error("Unauthorized");
      }
    } else if (!identity || thread.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const updates: {
      content: string;
      updatedAt: number;
      isStreaming?: boolean;
      tokenCount?: number;
      finishReason?: string;
      reasoning?: string;
    } = {
      content: args.content,
      updatedAt: Date.now(),
    };

    if (args.isStreaming !== undefined) updates.isStreaming = args.isStreaming;
    if (args.tokenCount !== undefined) updates.tokenCount = args.tokenCount;
    if (args.finishReason !== undefined)
      updates.finishReason = args.finishReason;
    if (args.reasoning !== undefined) updates.reasoning = args.reasoning;

    await ctx.db.patch(args.messageId, updates);

    // Update thread's updatedAt timestamp
    await ctx.db.patch(message.threadId, {
      updatedAt: Date.now(),
    });
  },
});

// Delete a message and all its children (for branching - supports both authenticated and anonymous)
export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check thread ownership/access
    const thread = await ctx.db.get(message.threadId);
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

    // Recursively delete child messages
    const childMessages = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentId", args.messageId))
      .collect();

    for (const child of childMessages) {
      await ctx.db.delete(child._id);
    }

    // Delete the message itself
    await ctx.db.delete(args.messageId);

    // Update thread's updatedAt timestamp
    await ctx.db.patch(message.threadId, {
      updatedAt: Date.now(),
    });
  },
});

// Get the latest message in a thread (useful for checking streaming status)
export const getLatestMessage = query({
  args: {
    threadId: v.id("threads"),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    // Check thread access
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return null; // Return null instead of throwing
    }

    const identity = await ctx.auth.getUserIdentity();

    // Check access permissions
    if (thread.isAnonymous && args.sessionId) {
      if (thread.sessionId !== args.sessionId) {
        return null; // Return null instead of throwing
      }
    } else if (thread.userId) {
      if (thread.userId !== identity?.subject && !thread.isPublic) {
        return null; // Return null instead of throwing
      }
    } else if (!thread.userId && !thread.isPublic) {
      // No identity and no session, and not public
      return null;
    }

    const message = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .first();

    return message;
  },
});

// Get message count for a thread
export const getMessageCount = query({
  args: {
    threadId: v.id("threads"),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    // Check thread access
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      return 0; // Return 0 instead of throwing
    }

    const identity = await ctx.auth.getUserIdentity();

    // Check access permissions
    if (thread.isAnonymous && args.sessionId) {
      if (thread.sessionId !== args.sessionId) {
        return 0; // Return 0 instead of throwing
      }
    } else if (thread.userId) {
      if (thread.userId !== identity?.subject && !thread.isPublic) {
        return 0; // Return 0 instead of throwing
      }
    } else if (!thread.userId && !thread.isPublic) {
      return 0;
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    return messages.length;
  },
});

// Get message counts for multiple threads (bulk query for efficiency)
export const getBulkMessageCounts = query({
  args: {
    threadIds: v.array(v.id("threads")),
    userId: v.string(), // User ID for authorization
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const counts: Record<string, number> = {};

    // Process threads in batches to avoid overwhelming the database
    for (const threadId of args.threadIds) {
      // Verify thread ownership
      const thread = await ctx.db.get(threadId);
      if (!thread || thread.userId !== args.userId) {
        // Skip threads that don't exist or don't belong to the user
        counts[threadId] = 0;
        continue;
      }

      // Get message count for this thread
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .collect();

      counts[threadId] = messages.length;
    }

    return counts;
  },
});

// Set message streaming status (for real-time updates)
export const setMessageStreamingStatus = mutation({
  args: {
    messageId: v.id("messages"),
    streamId: v.optional(v.string()),
    isStreaming: v.boolean(),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Check thread ownership/access
    const thread = await ctx.db.get(message.threadId);
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

    await ctx.db.patch(args.messageId, {
      isStreaming: args.isStreaming,
      streamId: args.streamId,
      updatedAt: Date.now(),
    });
  },
});

// Get message by stream ID (for streaming updates)
export const getMessageByStreamId = query({
  args: {
    streamId: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("messages")
      .withIndex("by_stream", (q) => q.eq("streamId", args.streamId))
      .unique();

    if (!message) {
      return null;
    }

    // Check thread access
    const thread = await ctx.db.get(message.threadId);
    if (!thread) {
      return null; // Return null instead of throwing
    }

    const identity = await ctx.auth.getUserIdentity();

    // Check access permissions
    if (thread.isAnonymous && args.sessionId) {
      if (thread.sessionId !== args.sessionId) {
        return null; // Return null instead of throwing
      }
    } else if (thread.userId) {
      if (thread.userId !== identity?.subject && !thread.isPublic) {
        return null; // Return null instead of throwing
      }
    } else if (!thread.userId && !thread.isPublic) {
      return null;
    }

    return message;
  },
});

// Create a message specifically for anonymous users (convenience wrapper around addMessage)
export const createAnonymousMessage = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
    reasoning: v.optional(v.string()), // Reasoning/thinking tokens from AI models
    sessionId: v.string(),
    role: v.optional(
      v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    ),
    parentId: v.optional(v.id("messages")),
    model: v.optional(v.string()),
    // Tool usage tracking
    toolsUsed: v.optional(v.array(v.string())),
    hasToolCalls: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate that this is indeed an anonymous thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    // Allow message creation if the original session still matches, even if the thread
    // has already been claimed (isAnonymous now false) in a concurrent flow.
    // This prevents a race condition where onFinish() is still persisting the final
    // assistant chunks right as the user finishes sign-in and the claiming mutation
    // flips `isAnonymous` to false. We purposely keep the strict sessionId match so
    // only the rightful browser session can append messages during that short gap.
    if (thread.sessionId !== args.sessionId) {
      throw new Error("Unauthorized or invalid session");
    }

    // Create the message directly using the same logic as addMessage
    const existingMessages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    const maxOrder = Math.max(0, ...existingMessages.map((m) => m.order));
    const now = Date.now();

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role ?? "user",
      content: args.content,
      reasoning: args.reasoning,
      parentId: args.parentId,
      order: maxOrder + 1,
      model: args.model,
      toolsUsed: args.toolsUsed,
      hasToolCalls: args.hasToolCalls,
      createdAt: now,
      updatedAt: now,
    });

    // Update thread's updatedAt timestamp
    await ctx.db.patch(args.threadId, {
      updatedAt: now,
    });

    return messageId;
  },
});

// -------------------------------------------------------------------
// INTERNAL: create a placeholder assistant message marked as streaming
// -------------------------------------------------------------------

export const createStreamingAssistant = internalMutation({
  args: {
    threadId: v.id("threads"),
    model: v.string(),
  },
  handler: async (ctx, { threadId, model }) => {
    const existingMessages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();

    const maxOrder = Math.max(0, ...existingMessages.map((m) => m.order));
    const now = Date.now();

    return ctx.db.insert("messages", {
      threadId,
      role: "assistant",
      content: "", // will be filled during streaming
      order: maxOrder + 1,
      model,
      isStreaming: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Remove the last assistant message (for retry functionality)
export const removeLastAssistantMessage = mutation({
  args: {
    threadId: v.id("threads"),
    sessionId: v.optional(v.string()), // For anonymous access
  },
  handler: async (ctx, args) => {
    // Check thread ownership/access
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const identity = await ctx.auth.getUserIdentity();

    // Seamless promotion of anonymous threads once the user authenticates
    if (
      thread.isAnonymous &&
      identity &&
      (!args.sessionId || thread.sessionId === args.sessionId)
    ) {
      await ctx.db.patch(args.threadId, {
        isAnonymous: false,
        userId: identity.subject,
        updatedAt: Date.now(),
      });
      thread.isAnonymous = false;
      thread.userId = identity.subject;
    }

    // Check authorization
    if (thread.isAnonymous) {
      if (!args.sessionId || thread.sessionId !== args.sessionId) {
        throw new Error("Unauthorized");
      }
    } else if (!identity || thread.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    // Find the last assistant message
    const lastAssistantMessage = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.eq(q.field("role"), "assistant"))
      .order("desc")
      .first();

    if (!lastAssistantMessage) {
      throw new Error("No assistant message to remove");
    }

    // Delete the message and any associated attachments
    await ctx.db.delete(lastAssistantMessage._id);

    // Also delete any attachments for this message
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) =>
        q.eq("messageId", lastAssistantMessage._id),
      )
      .collect();

    for (const attachment of attachments) {
      await ctx.db.delete(attachment._id);
    }

    // Update thread's updatedAt timestamp
    await ctx.db.patch(args.threadId, {
      updatedAt: Date.now(),
    });

    return lastAssistantMessage._id;
  },
});

// Check if a message is the latest assistant message in its thread
export const isLatestAssistantMessage = query({
  args: {
    messageId: v.id("messages"),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const message = await ctx.db.get(args.messageId);
      if (!message) {
        return false;
      }

      // Check thread access
      const thread = await ctx.db.get(message.threadId);
      if (!thread) {
        return false;
      }

      const identity = await ctx.auth.getUserIdentity();

      // Check access permissions
      if (thread.isAnonymous && args.sessionId) {
        if (thread.sessionId !== args.sessionId) {
          return false; // Return false instead of throwing
        }
      } else if (thread.userId) {
        if (thread.userId !== identity?.subject && !thread.isPublic) {
          return false;
        }
      } else if (!thread.userId && !thread.isPublic) {
        return false;
      }

      // Only check for assistant messages
      if (message.role !== "assistant") {
        return false;
      }

      // Find the latest assistant message in this thread
      const latestAssistantMessage = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", message.threadId))
        .filter((q) => q.eq(q.field("role"), "assistant"))
        .order("desc")
        .first();

      // Return true if this message is the latest assistant message
      return latestAssistantMessage?._id === args.messageId;
    } catch (error) {
      // Log error for debugging but don't throw to avoid breaking the UI
      console.error("Error checking if message is latest assistant:", error);
      return false;
    }
  },
});

// Get messages for a PUBLIC shared thread by its shareToken (no auth required)
export const getSharedThreadMessagesWithAttachments = query({
  args: {
    shareToken: v.string(),
  },
  handler: async (ctx, args) => {
    // Locate the thread via its share token
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.shareToken))
      .unique();

    if (!thread || !thread.isPublic) {
      return null; // Not found or no longer public
    }

    // If the share has expired, treat as not found
    if (thread.shareExpiresAt && thread.shareExpiresAt < Date.now()) {
      return null;
    }

    // Fetch all messages + attachments (same as private path)
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .collect();

    const messagesWithAttachments = await Promise.all(
      messages.map(async (message) => {
        const attachments = await ctx.db
          .query("attachments")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();

        return {
          ...message,
          attachments: attachments.map((att) => ({
            id: att._id,
            name: att.fileName,
            contentType: att.mimeType,
            url: att.fileUrl,
            size: att.fileSize,
          })),
        };
      }),
    );

    return messagesWithAttachments;
  },
});
