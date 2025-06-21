import { kv } from "@vercel/kv";

// Redis Pipelining Utilities for Performance Optimization
export const kvPipeline = {
  // Create a pipeline for batch operations
  async executePipeline<T extends readonly unknown[]>(
    operations: Array<() => Promise<unknown>>,
  ): Promise<T> {
    // Use Promise.all for concurrent execution (simulates pipelining behavior)
    try {
      const results = await Promise.all(operations.map((op) => op()));
      return results as unknown as T;
    } catch (error) {
      throw error;
    }
  },

  // Batch GET operations
  async mget(keys: string[]): Promise<(unknown | null)[]> {
    if (keys.length === 0) return [];

    // Use concurrent gets for better performance
    const operations = keys.map((key) => () => kv.get(key));
    return this.executePipeline(operations);
  },

  // Batch SET operations with TTL
  async msetex(
    entries: Array<{ key: string; value: unknown; ttl: number }>,
  ): Promise<boolean[]> {
    if (entries.length === 0) return [];

    const operations = entries.map(
      ({ key, value, ttl }) =>
        () =>
          kv.setex(
            key,
            ttl,
            typeof value === "string" ? value : JSON.stringify(value),
          ),
    );
    return this.executePipeline(operations);
  },

  // Batch DELETE operations
  async mdel(keys: string[]): Promise<number[]> {
    if (keys.length === 0) return [];

    const operations = keys.map((key) => () => kv.del(key));
    return this.executePipeline(operations);
  },
};

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

    // Use pipeline for atomic increment + expire operations
    const [count] = await kvPipeline.executePipeline<[number]>([
      () => kv.incr(key),
      () => kv.expire(key, windowSeconds),
    ]);

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

  // Batch check limits for multiple users
  async checkMultipleLimits(
    userIds: string[],
    windowSeconds = 60,
    maxRequests = 10,
  ): Promise<Record<string, boolean>> {
    if (userIds.length === 0) return {};

    const timestamp = Math.floor(Date.now() / 1000 / windowSeconds);
    const keys = userIds.map((userId) => `rate:${userId}:${timestamp}`);

    // Get current counts for all users
    const counts = await kvPipeline.mget(keys);

    // Prepare increment operations for users who haven't exceeded limit
    const incrementOps: Array<() => Promise<unknown>> = [];
    const expireOps: Array<() => Promise<unknown>> = [];
    const results: Record<string, boolean> = {};

    userIds.forEach((userId, index) => {
      const currentCount = (counts[index] as number) ?? 0;
      const allowed = currentCount < maxRequests;
      results[userId] = allowed;

      if (allowed) {
        const key = keys[index];
        incrementOps.push(() => kv.incr(key));
        expireOps.push(() => kv.expire(key, windowSeconds));
      }
    });

    // Execute increments and expires in parallel
    if (incrementOps.length > 0) {
      await Promise.all([
        kvPipeline.executePipeline(incrementOps),
        kvPipeline.executePipeline(expireOps),
      ]);
    }

    return results;
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

  // Transfer session data from one session to another (for background thread transfers)
  async transferSessionData(fromSessionId: string, toSessionId: string) {
    try {
      // Get all keys for the source session
      const keys: string[] = [];

      // Scan for all session keys
      for await (const key of kv.scanIterator()) {
        if (key.startsWith(`session:${fromSessionId}:`)) {
          keys.push(key);
        }
      }

      if (keys.length === 0) return { transferredKeys: 0 };

      // Batch fetch all source session data
      const values = await kvPipeline.mget(keys);
      const transferOps: Array<{ key: string; value: unknown; ttl: number }> =
        [];
      const deleteOps: string[] = [];

      // Prepare transfer operations
      keys.forEach((key, index) => {
        const value = values[index];
        if (value !== null) {
          // Transform key from source to destination session
          const keyPart = key.replace(`session:${fromSessionId}:`, "");
          const newKey = `session:${toSessionId}:${keyPart}`;

          transferOps.push({
            key: newKey,
            value,
            ttl: 1800, // Default TTL for transferred data
          });
          deleteOps.push(key);
        }
      });

      // Execute transfer operations
      if (transferOps.length > 0) {
        await kvPipeline.msetex(transferOps);
        await kvPipeline.mdel(deleteOps);
      }

      return { transferredKeys: transferOps.length };
    } catch (error) {
      return { transferredKeys: 0, error };
    }
  },

  // Merge rate limit data between sessions (add counts together, don't exceed limit)
  async mergeRateLimitData(
    fromSessionId: string,
    toSessionId: string,
    windowSeconds = 60,
    maxLimit = 10,
  ) {
    try {
      const currentWindow = Math.floor(Date.now() / 1000 / windowSeconds);
      const fromKey = `rate:${fromSessionId}:${currentWindow}`;
      const toKey = `rate:${toSessionId}:${currentWindow}`;

      // Get current counts
      const [fromCount, toCount] = await kvPipeline.mget([fromKey, toKey]);

      const fromVal = (fromCount as number) || 0;
      const toVal = (toCount as number) || 0;

      // Add the counts together, but cap at the maximum limit to prevent abuse
      const mergedCount = Math.min(fromVal + toVal, maxLimit);

      if (mergedCount > 0) {
        await kv.setex(toKey, windowSeconds, mergedCount);
      }

      // Always delete the old session's rate limit data
      await kv.del(fromKey);

      return { mergedCount };
    } catch (error) {
      return { mergedCount: 0, error };
    }
  },

  // Completely delete all data for a session (cleanup old session)
  async deleteAllSessionData(sessionId: string) {
    try {
      // Get all keys for the session
      const keys: string[] = [];

      // Scan for all session-related keys
      for await (const key of kv.scanIterator()) {
        if (
          key.startsWith(`session:${sessionId}:`) ||
          key.startsWith(`rate:${sessionId}:`)
        ) {
          keys.push(key);
        }
      }

      if (keys.length === 0) return { deletedKeys: 0 };

      // Delete all session data
      await kvPipeline.mdel(keys);

      return { deletedKeys: keys.length };
    } catch (error) {
      return { deletedKeys: 0, error };
    }
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

    // Ensure we only store the last 10 messages to keep the cache lean
    if (context.messages.length > 10) {
      context.messages = context.messages.slice(-10);
      context.messageCount = context.messages.length;
    }

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
      } catch {
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

    // Keep only last 10 messages to prevent cache bloat
    if (context.messages.length > 10) {
      context.messages = context.messages.slice(-10);
    }

    return this.setContext(threadId, context, ttl);
  },

  // Get recent messages for context window
  async getRecentMessages(
    threadId: string,
    limit = 10,
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
    if (threadIds.length === 0) return {};

    const results: Record<string, ConversationContext | null> = {};

    try {
      // Use pipelining for much better performance
      const keys = threadIds.map((threadId) => `conversation:${threadId}`);
      const cachedResults = await kvPipeline.mget(keys);

      // Process results
      threadIds.forEach((threadId, index) => {
        const cached = cachedResults[index];
        if (!cached) {
          results[threadId] = null;
          return;
        }

        // Handle both string and object responses from KV
        if (typeof cached === "string") {
          try {
            results[threadId] = JSON.parse(cached);
          } catch {
            results[threadId] = null;
          }
        } else if (typeof cached === "object") {
          // KV returned an object directly
          results[threadId] = cached as ConversationContext;
        } else {
          results[threadId] = null;
        }
      });
    } catch {
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
      const keys: string[] = [];
      // Use scanIterator without pattern option to scan all keys
      for await (const key of kv.scanIterator()) {
        if (key.startsWith("conversation:")) {
          keys.push(key);
        }
      }

      if (keys.length === 0) return 0;

      // Batch fetch all conversation contexts for analysis
      const contexts = await kvPipeline.mget(keys);
      const keysToDelete: string[] = [];

      contexts.forEach((context, index) => {
        if (context) {
          let parsed: ConversationContext;
          if (typeof context === "string") {
            try {
              parsed = JSON.parse(context);
            } catch {
              // Delete invalid entries
              keysToDelete.push(keys[index]);
              return;
            }
          } else {
            parsed = context as ConversationContext;
          }

          if (parsed.lastUpdated < cutoffTime) {
            keysToDelete.push(keys[index]);
          }
        }
      });

      // Use pipelining for batch deletion
      if (keysToDelete.length > 0) {
        await kvPipeline.mdel(keysToDelete);
      }

      return keysToDelete.length;
    } catch {
      return 0;
    }
  },
};

export { kv };
