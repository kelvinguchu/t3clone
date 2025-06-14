import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  // Chat threads/conversations
  threads: defineTable({
    // Thread metadata
    title: v.string(),
    userId: v.optional(v.string()), // Clerk user ID - optional for anonymous users

    // Anonymous session support
    sessionId: v.optional(v.string()), // Anonymous session ID for non-authenticated users
    isAnonymous: v.optional(v.boolean()), // Flag to identify anonymous threads
    ipHash: v.optional(v.string()), // Hashed IP to group sessions for migration

    // Thread settings
    model: v.string(), // 'gpt-4', 'claude-3', 'gemini-pro', etc.
    systemPrompt: v.optional(v.string()),

    // Branching - for conversation branches
    parentThreadId: v.optional(v.id("threads")), // If this thread is a branch of another
    branchFromMessageId: v.optional(v.id("messages")), // Which message this branch started from

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Share settings
    isPublic: v.optional(v.boolean()),
    shareToken: v.optional(v.string()),
    shareExpiresAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"]) // Index for anonymous session lookup
    .index("by_anonymous", ["isAnonymous", "createdAt"]) // Index for anonymous threads
    .index("by_share_token", ["shareToken"])
    .index("by_updated", ["updatedAt"])
    .index("by_ip_hash", ["ipHash"]),

  // Stream tracking for resumable streams
  streams: defineTable({
    chatId: v.string(), // Thread ID as string
    streamId: v.string(), // Unique stream ID
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("error"),
    ),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_chat", ["chatId", "createdAt"])
    .index("by_stream", ["streamId"]),

  // Individual messages within threads
  messages: defineTable({
    threadId: v.id("threads"),

    // Message content
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
    ),
    content: v.string(),

    // Message tree structure for branching
    parentId: v.optional(v.id("messages")), // For branching conversations
    order: v.number(), // Order within the thread/branch

    // AI generation metadata
    model: v.optional(v.string()),
    tokenCount: v.optional(v.number()),
    finishReason: v.optional(v.string()),

    // Tool usage tracking
    toolsUsed: v.optional(v.array(v.string())), // Array of tool names that were called (e.g., ["duckDuckGoSearch", "webBrowse"])
    hasToolCalls: v.optional(v.boolean()), // Quick flag to indicate if any tools were used

    // Duplication flag (true if message was cloned during branching)
    cloned: v.optional(v.boolean()),

    // Stream state
    isStreaming: v.optional(v.boolean()),
    streamId: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_thread", ["threadId", "createdAt"])
    .index("by_thread_order", ["threadId", "order"])
    .index("by_parent", ["parentId"])
    .index("by_stream", ["streamId"]),

  // File attachments
  attachments: defineTable({
    threadId: v.optional(v.id("threads")), // Optional for standalone uploads
    messageId: v.optional(v.id("messages")), // Which message this attachment belongs to

    // File metadata
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),

    // UploadThing storage
    fileUrl: v.string(), // UploadThing URL
    fileKey: v.string(), // UploadThing file key

    // Processing status
    status: v.union(
      v.literal("uploading"),
      v.literal("processed"),
      v.literal("error"),
    ),

    // OCR/extraction results (for future features)
    extractedText: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_message", ["messageId"])
    .index("by_status", ["status"]),

  // Usage tracking and cost management
  usage: defineTable({
    userId: v.string(), // Clerk user ID

    // Monthly usage counters
    month: v.string(), // Format: 'YYYY-MM'
    tokensUsed: v.number(),
    requestsCount: v.number(),
    costInCents: v.number(),

    // Provider breakdown - flexible record for any provider
    providerUsage: v.record(
      v.string(), // provider name
      v.object({
        tokens: v.number(),
        requests: v.number(),
        costInCents: v.number(),
      }),
    ),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_month", ["userId", "month"]),

  // User preferences and settings
  userSettings: defineTable({
    userId: v.string(), // Clerk user ID

    // AI preferences
    defaultModel: v.string(),
    defaultSystemPrompt: v.optional(v.string()),

    // UI preferences
    theme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
    codeTheme: v.optional(v.string()),

    // Feature flags
    enableWebSearch: v.optional(v.boolean()),
    enableImageGeneration: v.optional(v.boolean()),

    // API keys (encrypted, user-provided)
    hasCustomOpenAI: v.optional(v.boolean()),
    hasCustomAnthropic: v.optional(v.boolean()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
