import { kv } from "@vercel/kv";

// Stream checkpointing for resumable conversations
export const streamCache = {
  async setCheckpoint(threadId: string, tokenIndex: number, ttl = 3600) {
    return kv.setex(`stream:${threadId}`, ttl, tokenIndex);
  },

  async getCheckpoint(threadId: string): Promise<number | null> {
    return kv.get(`stream:${threadId}`);
  },

  async clearCheckpoint(threadId: string) {
    return kv.del(`stream:${threadId}`);
  },
};

// Rate limiting per user
export const rateLimiter = {
  async checkLimit(userId: string, windowSeconds = 60, maxRequests = 10) {
    const key = `rate:${userId}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const count = await kv.incr(key);
    await kv.expire(key, windowSeconds);
    return count <= maxRequests;
  },

  async getRemainingRequests(
    userId: string,
    windowSeconds = 60,
    maxRequests = 10,
  ) {
    const key = `rate:${userId}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    const count = (await kv.get(key)) ?? 0;
    return Math.max(0, maxRequests - (count as number));
  },
};

// Search results caching (for web search feature)
export const searchCache = {
  async setResults(query: string, results: unknown, ttl = 300) {
    const key = `search:${Buffer.from(query).toString("base64")}`;
    return kv.setex(key, ttl, JSON.stringify(results));
  },

  async getResults(query: string) {
    const key = `search:${Buffer.from(query).toString("base64")}`;
    const cached = await kv.get(key);
    if (!cached) return null;

    if (typeof cached === "string") {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    return cached; // Return object directly
  },
};

// Share link tokens for public chat sharing
export const shareTokens = {
  async createToken(threadId: string, ttl = 86400) {
    const token = crypto.randomUUID();
    await kv.setex(`share:${token}`, ttl, threadId);
    return token;
  },

  async validateToken(token: string): Promise<string | null> {
    return kv.get(`share:${token}`);
  },

  async revokeToken(token: string) {
    return kv.del(`share:${token}`);
  },

  async extendToken(token: string, additionalTtl = 86400) {
    const threadId = await kv.get(`share:${token}`);
    if (threadId) {
      await kv.expire(`share:${token}`, additionalTtl);
      return true;
    }
    return false;
  },
};

// Session-based temporary data
export const sessionCache = {
  async set(sessionId: string, key: string, value: unknown, ttl = 1800) {
    const fullKey = `session:${sessionId}:${key}`;
    return kv.setex(fullKey, ttl, JSON.stringify(value));
  },

  async get(sessionId: string, key: string) {
    const fullKey = `session:${sessionId}:${key}`;
    const cached = await kv.get(fullKey);
    if (!cached) return null;

    if (typeof cached === "string") {
      try {
        return JSON.parse(cached);
      } catch {
        return cached; // Return as-is if not valid JSON
      }
    }
    return cached; // Return object directly
  },

  async del(sessionId: string, key: string) {
    const fullKey = `session:${sessionId}:${key}`;
    return kv.del(fullKey);
  },
};

// Conversation context caching for LLM quick access
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  model?: string;
  messageId?: string;
}

export interface ConversationContext {
  threadId: string;
  messages: ConversationMessage[];
  model: string;
  userId?: string;
  sessionId?: string;
  lastUpdated: number;
  messageCount: number;
}

export const conversationCache = {
  // Store full conversation context for quick LLM access
  async setContext(
    threadId: string,
    context: ConversationContext,
    ttl = 7200, // 2 hours default
  ) {
    const key = `conversation:${threadId}`;
    return kv.setex(key, ttl, JSON.stringify(context));
  },

  // Get full conversation context
  async getContext(threadId: string): Promise<ConversationContext | null> {
    const key = `conversation:${threadId}`;
    const cached = await kv.get(key);
    if (!cached) return null;

    // Handle both string and object responses from KV
    if (typeof cached === "string") {
      try {
        return JSON.parse(cached);
      } catch (error) {
        console.error(
          `Failed to parse conversation context for ${threadId}:`,
          error,
        );
        return null;
      }
    } else if (typeof cached === "object") {
      // KV returned an object directly
      return cached as ConversationContext;
    }

    return null;
  },

  // Add a single message to existing conversation cache
  async appendMessage(
    threadId: string,
    message: ConversationMessage,
    ttl = 7200,
  ) {
    const context = await this.getContext(threadId);
    if (!context) {
      // Create new context if none exists
      const newContext: ConversationContext = {
        threadId,
        messages: [message],
        model: message.model ?? "gemini-2.0-flash",
        lastUpdated: Date.now(),
        messageCount: 1,
      };
      return this.setContext(threadId, newContext, ttl);
    }

    // Append to existing context
    context.messages.push(message);
    context.lastUpdated = Date.now();
    context.messageCount = context.messages.length;

    // Keep only last 50 messages to prevent cache bloat
    if (context.messages.length > 50) {
      context.messages = context.messages.slice(-50);
    }

    return this.setContext(threadId, context, ttl);
  },

  // Get recent messages for context window
  async getRecentMessages(
    threadId: string,
    limit = 20,
  ): Promise<ConversationMessage[]> {
    const context = await this.getContext(threadId);
    if (!context) return [];

    return context.messages.slice(-limit);
  },

  // Update conversation metadata
  async updateMetadata(
    threadId: string,
    updates: Partial<
      Pick<ConversationContext, "model" | "userId" | "sessionId">
    >,
    ttl = 7200,
  ) {
    const context = await this.getContext(threadId);
    if (!context) return false;

    Object.assign(context, updates, { lastUpdated: Date.now() });
    return this.setContext(threadId, context, ttl);
  },

  // Clear conversation cache
  async clearContext(threadId: string) {
    const key = `conversation:${threadId}`;
    return kv.del(key);
  },

  // Get conversation summary for quick context
  async getContextSummary(threadId: string) {
    const context = await this.getContext(threadId);
    if (!context) return null;

    return {
      threadId: context.threadId,
      messageCount: context.messageCount,
      model: context.model,
      lastUpdated: context.lastUpdated,
      hasMessages: context.messages.length > 0,
      recentMessagePreview: context.messages.slice(-3).map((m) => ({
        role: m.role,
        contentPreview:
          m.content.slice(0, 100) + (m.content.length > 100 ? "..." : ""),
        timestamp: m.timestamp,
      })),
    };
  },

  // Batch operations for multiple conversations
  async getMultipleContexts(
    threadIds: string[],
  ): Promise<Record<string, ConversationContext | null>> {
    const results: Record<string, ConversationContext | null> = {};

    // Use individual requests since Vercel KV pipeline API may vary
    try {
      await Promise.all(
        threadIds.map(async (threadId) => {
          results[threadId] = await this.getContext(threadId);
        }),
      );
    } catch (error) {
      console.error("Batch conversation fetch failed:", error);
      // Fallback to individual requests one by one
      for (const threadId of threadIds) {
        try {
          results[threadId] = await this.getContext(threadId);
        } catch {
          results[threadId] = null;
        }
      }
    }

    return results;
  },

  // Clean up old conversations (utility for maintenance)
  async cleanupOldContexts(olderThanDays = 7) {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    try {
      const keys = [];
      // Use scanIterator without pattern option to scan all keys
      for await (const key of kv.scanIterator()) {
        if (key.startsWith("conversation:")) {
          keys.push(key);
        }
      }

      const keysToDelete = [];
      for (const key of keys) {
        const context = await kv.get(key);
        if (context) {
          let parsed: ConversationContext;
          if (typeof context === "string") {
            try {
              parsed = JSON.parse(context);
            } catch {
              continue; // Skip invalid entries
            }
          } else {
            parsed = context as ConversationContext;
          }

          if (parsed.lastUpdated < cutoffTime) {
            keysToDelete.push(key);
          }
        }
      }

      if (keysToDelete.length > 0) {
        await kv.del(...keysToDelete);
      }

      return keysToDelete.length;
    } catch (error) {
      console.error("Cleanup failed:", error);
      return 0;
    }
  },
};

export { kv };
