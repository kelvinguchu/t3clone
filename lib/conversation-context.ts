import { conversationCache, type ConversationMessage } from "@/lib/kv";

// Token estimation (rough approximation: 1 token ≈ 4 characters)
const CHARS_PER_TOKEN = 4;
const DEFAULT_CONTEXT_WINDOW = 8000; // tokens
const MAX_MESSAGES_PER_CONTEXT = 100;

// Re-export conversationCache for convenience
export { conversationCache };

export interface ContextOptions {
  maxTokens?: number;
  maxMessages?: number;
  prioritizeRecent?: boolean;
  model?: string;
}

export interface FormattedContext {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  metadata: {
    threadId: string;
    totalMessages: number;
    includedMessages: number;
    estimatedTokens: number;
    lastUpdated: number;
    model?: string;
  };
}

/**
 * Get optimized conversation context for LLM requests
 */
export async function getConversationContext(
  threadId: string,
  options: ContextOptions = {},
): Promise<FormattedContext | null> {
  const {
    maxTokens = DEFAULT_CONTEXT_WINDOW,
    maxMessages = MAX_MESSAGES_PER_CONTEXT,
    prioritizeRecent = true,
  } = options;

  try {
    const context = await conversationCache.getContext(threadId);
    if (!context) {
      return null;
    }

    // Get messages in the right order
    let messages = [...context.messages];
    if (prioritizeRecent) {
      messages = messages.slice(-maxMessages);
    }

    // Format messages for LLM
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Trim to fit token limit
    const trimmedMessages = trimToTokenLimit(formattedMessages, maxTokens);
    const estimatedTokens = estimateTokens(
      trimmedMessages.map((m) => m.content).join(" "),
    );

    return {
      messages: trimmedMessages,
      metadata: {
        threadId,
        totalMessages: context.messageCount,
        includedMessages: trimmedMessages.length,
        estimatedTokens,
        lastUpdated: context.lastUpdated,
        model: context.model,
      },
    };
  } catch (error) {
    console.error("Failed to get conversation context:", error);
    return null;
  }
}

/**
 * Get recent messages for quick context
 */
export async function getRecentContext(
  threadId: string,
  messageLimit = 10,
): Promise<ConversationMessage[]> {
  try {
    return await conversationCache.getRecentMessages(threadId, messageLimit);
  } catch (error) {
    console.error("Failed to get recent context:", error);
    return [];
  }
}

/**
 * Get conversation summary for LLM context optimization
 */
export async function getConversationSummary(threadId: string) {
  try {
    return await conversationCache.getContextSummary(threadId);
  } catch (error) {
    console.error("Failed to get conversation summary:", error);
    return null;
  }
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Trim messages to fit within token limit
 */
function trimToTokenLimit(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): Array<{ role: "user" | "assistant" | "system"; content: string }> {
  const result = [];
  let totalTokens = 0;

  // Always keep system message if it's first
  const hasSystemMessage = messages[0]?.role === "system";
  let startIndex = 0;

  if (hasSystemMessage) {
    const systemTokens = estimateTokens(messages[0].content);
    if (systemTokens < maxTokens) {
      result.push(
        messages[0] as {
          role: "user" | "assistant" | "system";
          content: string;
        },
      );
      totalTokens += systemTokens;
      startIndex = 1;
    }
  }

  // Add messages from most recent backwards until we hit the limit
  for (let i = messages.length - 1; i >= startIndex; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content);

    if (totalTokens + msgTokens <= maxTokens) {
      result.unshift(
        msg as { role: "user" | "assistant" | "system"; content: string },
      );
      totalTokens += msgTokens;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Batch get contexts for multiple threads (useful for related conversations)
 */
export async function getBatchContext(
  threadIds: string[],
  options: ContextOptions = {},
): Promise<Record<string, FormattedContext | null>> {
  const results: Record<string, FormattedContext | null> = {};

  try {
    const contexts = await conversationCache.getMultipleContexts(threadIds);

    for (const [threadId, context] of Object.entries(contexts)) {
      if (context) {
        results[threadId] = await getConversationContext(threadId, options);
      } else {
        results[threadId] = null;
      }
    }
  } catch (error) {
    console.error("Failed to get batch context:", error);
    // Fallback to individual requests
    for (const threadId of threadIds) {
      results[threadId] = await getConversationContext(threadId, options);
    }
  }

  return results;
}

/**
 * Smart context retrieval that adjusts based on model capabilities
 */
export async function getSmartContext(
  threadId: string,
  model: string,
): Promise<FormattedContext | null> {
  // Model-specific context window sizes (approximate)
  const modelLimits: Record<string, number> = {
    "llama3-70b-8192": 8192,
    "deepseek-r1-distill-llama-70b": 8192,
    "qwen/qwen3-32b": 32768,
    "gemini-2.0-flash": 32000,
    "gemini-2.0-flash-preview-image-generation": 32000,
    "gpt-4.1-mini": 128000,
  };

  const maxTokens = modelLimits[model] || DEFAULT_CONTEXT_WINDOW;

  return getConversationContext(threadId, {
    maxTokens: Math.floor(maxTokens * 0.8), // Leave room for response
    model,
    prioritizeRecent: true,
  });
}

/**
 * Export utility for clearing old conversation caches
 */
export async function cleanupOldConversations(
  olderThanDays = 7,
): Promise<number> {
  try {
    return await conversationCache.cleanupOldContexts(olderThanDays);
  } catch (error) {
    console.error("Failed to cleanup old conversations:", error);
    return 0;
  }
}
