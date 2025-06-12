import { v } from "convex/values";
import { query } from "./_generated/server";

// Anonymous session stats (thread + message counts)
export const getAnonymousSessionStats = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Fetch all threads that belong to this anonymous session
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Count the number of user role messages across all session threads
    let messageCount = 0;
    for (const thread of threads) {
      const userMessages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .filter((q) =>
          q.and(
            q.eq(q.field("role"), "user"),
            q.or(
              q.eq(q.field("cloned"), undefined),
              q.eq(q.field("cloned"), false),
            ),
          ),
        )
        .collect();
      messageCount += userMessages.length;
    }

    // Hard-coded limit – keep in sync with utils/session.ts
    const MAX_MESSAGES_PER_SESSION = 10;
    const remainingMessages = Math.max(
      0,
      MAX_MESSAGES_PER_SESSION - messageCount,
    );

    return {
      threadCount: threads.length,
      messageCount,
      remainingMessages,
    };
  },
});
