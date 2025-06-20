import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user settings (read-only)
export const getUserSettings = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Create default user settings (mutation)
export const createUserSettings = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Check if settings already exist
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("userSettings", {
      userId: args.userId,
      defaultModel: "gemini-2.0-flash",
      theme: "system",
      enableWebSearch: false,
      enableImageGeneration: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update user settings
export const updateUserSettings = mutation({
  args: {
    userId: v.string(),
    defaultModel: v.optional(v.string()),
    defaultSystemPrompt: v.optional(v.string()),
    theme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
    codeTheme: v.optional(v.string()),
    enableWebSearch: v.optional(v.boolean()),
    enableImageGeneration: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const now = Date.now();

    if (!userSettings) {
      // Create new settings
      const settingsId = await ctx.db.insert("userSettings", {
        userId: args.userId,
        defaultModel: args.defaultModel ?? "gemini-2.0-flash",
        defaultSystemPrompt: args.defaultSystemPrompt,
        theme: args.theme ?? "system",
        codeTheme: args.codeTheme,
        enableWebSearch: args.enableWebSearch || false,
        enableImageGeneration: args.enableImageGeneration || false,
        createdAt: now,
        updatedAt: now,
      });
      return settingsId;
    } else {
      // Update existing settings
      const updates: {
        updatedAt: number;
        defaultModel?: string;
        defaultSystemPrompt?: string;
        theme?: "light" | "dark" | "system";
        codeTheme?: string;
        enableWebSearch?: boolean;
        enableImageGeneration?: boolean;
      } = {
        updatedAt: now,
      };

      if (args.defaultModel !== undefined)
        updates.defaultModel = args.defaultModel;
      if (args.defaultSystemPrompt !== undefined)
        updates.defaultSystemPrompt = args.defaultSystemPrompt;
      if (args.theme !== undefined) updates.theme = args.theme;
      if (args.codeTheme !== undefined) updates.codeTheme = args.codeTheme;
      if (args.enableWebSearch !== undefined)
        updates.enableWebSearch = args.enableWebSearch;
      if (args.enableImageGeneration !== undefined)
        updates.enableImageGeneration = args.enableImageGeneration;

      await ctx.db.patch(userSettings._id, updates);
      return userSettings._id;
    }
  },
});

// Get user usage for current month
export const getCurrentUsage = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // Format: 'YYYY-MM'

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("month", currentMonth),
      )
      .unique();

    return (
      usage || {
        userId: args.userId,
        month: currentMonth,
        tokensUsed: 0,
        requestsCount: 0,
        costInCents: 0,
        providerUsage: {},
      }
    );
  },
});

// Update usage statistics
export const updateUsage = mutation({
  args: {
    userId: v.string(),
    provider: v.string(),
    tokens: v.number(),
    costInCents: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("month", currentMonth),
      )
      .unique();

    const now = Date.now();

    if (!usage) {
      // Create new usage record
      const providerUsage = {
        [args.provider]: {
          tokens: args.tokens,
          requests: 1,
          costInCents: args.costInCents,
        },
      };

      await ctx.db.insert("usage", {
        userId: args.userId,
        month: currentMonth,
        tokensUsed: args.tokens,
        requestsCount: 1,
        costInCents: args.costInCents,
        providerUsage,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Update existing usage
      const newProviderUsage = { ...usage.providerUsage };

      if (newProviderUsage[args.provider]) {
        newProviderUsage[args.provider] = {
          tokens: newProviderUsage[args.provider].tokens + args.tokens,
          requests: newProviderUsage[args.provider].requests + 1,
          costInCents:
            newProviderUsage[args.provider].costInCents + args.costInCents,
        };
      } else {
        newProviderUsage[args.provider] = {
          tokens: args.tokens,
          requests: 1,
          costInCents: args.costInCents,
        };
      }

      await ctx.db.patch(usage._id, {
        tokensUsed: usage.tokensUsed + args.tokens,
        requestsCount: usage.requestsCount + 1,
        costInCents: usage.costInCents + args.costInCents,
        providerUsage: newProviderUsage,
        updatedAt: now,
      });
    }
  },
});

// Get usage history for a user
export const getUsageHistory = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const limit = args.limit ?? 12; // Default to 12 months

    const usageHistory = await ctx.db
      .query("usage")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .take(limit);

    return usageHistory;
  },
});

// Check if user has exceeded usage limits
export const checkUsageLimits = query({
  args: {
    userId: v.string(),
    monthlyTokenLimit: v.optional(v.number()),
    monthlyRequestLimit: v.optional(v.number()),
    monthlyCostLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const currentUsage = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) =>
        q
          .eq("userId", args.userId)
          .eq("month", new Date().toISOString().slice(0, 7)),
      )
      .unique();

    if (!currentUsage) {
      return {
        tokensExceeded: false,
        requestsExceeded: false,
        costExceeded: false,
        currentTokens: 0,
        currentRequests: 0,
        currentCostInCents: 0,
      };
    }

    return {
      tokensExceeded: args.monthlyTokenLimit
        ? currentUsage.tokensUsed >= args.monthlyTokenLimit
        : false,
      requestsExceeded: args.monthlyRequestLimit
        ? currentUsage.requestsCount >= args.monthlyRequestLimit
        : false,
      costExceeded: args.monthlyCostLimit
        ? currentUsage.costInCents >= args.monthlyCostLimit
        : false,
      currentTokens: currentUsage.tokensUsed,
      currentRequests: currentUsage.requestsCount,
      currentCostInCents: currentUsage.costInCents,
    };
  },
});

// Plan-based rate limiting for authenticated users
export const checkPlanLimit = query({
  args: {
    userId: v.string(),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const plan = args.plan || "free";
    const limits = getPlanLimits(plan);
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // For monthly limits, use month format YYYY-MM
    const period =
      limits.period === "monthly"
        ? new Date().toISOString().slice(0, 7)
        : today;

    // Query existing usage for this period
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("month", period),
      )
      .first();

    const currentCount = usage?.requestsCount || 0;
    const remaining =
      limits.daily === -1 ? -1 : Math.max(0, limits.daily - currentCount);

    // Calculate reset time
    let resetTime: number;
    if (limits.period === "monthly") {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      resetTime = nextMonth.getTime();
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      resetTime = tomorrow.getTime();
    }

    return {
      canSend: limits.daily === -1 || remaining > 0,
      remaining,
      total: limits.daily,
      resetTime,
      used: currentCount,
      percentage:
        limits.daily === -1
          ? 0
          : Math.min(100, (currentCount / limits.daily) * 100),
    };
  },
});

// Increment user's message count for plan limiting
export const incrementPlanUsage = mutation({
  args: {
    userId: v.string(),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const plan = args.plan || "free";
    const limits = getPlanLimits(plan);

    // For monthly limits, use month format YYYY-MM
    const period =
      limits.period === "monthly"
        ? new Date().toISOString().slice(0, 7)
        : new Date().toISOString().split("T")[0];

    // Get existing usage
    const existingUsage = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("month", period),
      )
      .first();

    const currentCount = existingUsage?.requestsCount || 0;

    // Check limit before incrementing
    if (limits.daily !== -1 && currentCount >= limits.daily) {
      return {
        success: false,
        remaining: 0,
        total: limits.daily,
        used: currentCount,
      };
    }

    const now = Date.now();

    if (existingUsage) {
      // Update existing usage record
      await ctx.db.patch(existingUsage._id, {
        requestsCount: currentCount + 1,
        updatedAt: now,
      });
    } else {
      // Create new usage record
      await ctx.db.insert("usage", {
        userId: args.userId,
        month: period,
        tokensUsed: 0,
        requestsCount: 1,
        costInCents: 0,
        providerUsage: {},
        createdAt: now,
        updatedAt: now,
      });
    }

    const newCount = currentCount + 1;
    const remaining =
      limits.daily === -1 ? -1 : Math.max(0, limits.daily - newCount);

    return {
      success: true,
      remaining,
      total: limits.daily,
      used: newCount,
    };
  },
});

// Get user's current usage stats for plan limiting
export const getUserPlanStats = query({
  args: {
    userId: v.string(),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      return {
        used: 0,
        remaining: 0,
        total: 0,
        resetTime: Date.now(),
        percentage: 0,
        plan: args.plan || "free",
      } as const;
    }

    const plan = args.plan || "free";
    const limits = getPlanLimits(plan);

    // For monthly limits, use month format YYYY-MM
    const period =
      limits.period === "monthly"
        ? new Date().toISOString().slice(0, 7)
        : new Date().toISOString().split("T")[0];

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("month", period),
      )
      .first();

    const used = usage?.requestsCount || 0;
    const remaining =
      limits.daily === -1 ? -1 : Math.max(0, limits.daily - used);

    // Calculate reset time
    let resetTime: number;
    if (limits.period === "monthly") {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      resetTime = nextMonth.getTime();
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      resetTime = tomorrow.getTime();
    }

    return {
      used,
      remaining,
      total: limits.daily,
      resetTime,
      percentage:
        limits.daily === -1 ? 0 : Math.min(100, (used / limits.daily) * 100),
      plan,
    };
  },
});

// Helper function to get plan limits
function getPlanLimits(plan: string): {
  daily: number;
  period: "daily" | "monthly";
} {
  const planLimits = {
    free: { daily: 25, period: "daily" as const },
    pro: { daily: 1500, period: "monthly" as const },
  };

  return planLimits[plan as keyof typeof planLimits] || planLimits.free;
}

// Reset user's usage (admin function)
export const resetUserPlanUsage = mutation({
  args: {
    userId: v.string(),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const plan = args.plan || "free";
    const limits = getPlanLimits(plan);

    const period =
      limits.period === "monthly"
        ? new Date().toISOString().slice(0, 7)
        : new Date().toISOString().split("T")[0];

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", args.userId).eq("month", period),
      )
      .first();

    if (usage) {
      await ctx.db.patch(usage._id, {
        requestsCount: 0,
        updatedAt: Date.now(),
      });
      return true;
    }

    return false;
  },
});

// Update user plan (for payment processing)
export const updateUserPlan = mutation({
  args: {
    userId: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro")),
    paymentId: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    paymentAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    // Get or create user settings
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!userSettings) {
      // Create new settings with the plan
      const settingsId = await ctx.db.insert("userSettings", {
        userId: args.userId,
        defaultModel: "gemini-2.0-flash",
        theme: "system",
        enableWebSearch: false,
        enableImageGeneration: false,
        plan: args.plan,
        planUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Log the plan change
      if (args.plan === "pro" && args.paymentId) {
        await ctx.db.insert("usage", {
          userId: args.userId,
          month: new Date().toISOString().slice(0, 7),
          tokensUsed: 0,
          requestsCount: 0,
          costInCents: 0,
          providerUsage: {},
          planUpgrade: {
            paymentId: args.paymentId,
            paymentMethod: args.paymentMethod,
            paymentAmount: args.paymentAmount,
            upgradedAt: now,
          },
          createdAt: now,
          updatedAt: now,
        });
      }

      return settingsId;
    } else {
      // Update existing settings
      await ctx.db.patch(userSettings._id, {
        plan: args.plan,
        planUpdatedAt: now,
        updatedAt: now,
      });

      // Log the plan change if upgrading to pro
      if (args.plan === "pro" && args.paymentId) {
        const currentMonth = new Date().toISOString().slice(0, 7);

        // Get or create usage record for current month
        const usage = await ctx.db
          .query("usage")
          .withIndex("by_user_month", (q) =>
            q.eq("userId", args.userId).eq("month", currentMonth),
          )
          .unique();

        if (!usage) {
          await ctx.db.insert("usage", {
            userId: args.userId,
            month: currentMonth,
            tokensUsed: 0,
            requestsCount: 0,
            costInCents: 0,
            providerUsage: {},
            planUpgrade: {
              paymentId: args.paymentId,
              paymentMethod: args.paymentMethod,
              paymentAmount: args.paymentAmount,
              upgradedAt: now,
            },
            createdAt: now,
            updatedAt: now,
          });
        } else {
          await ctx.db.patch(usage._id, {
            planUpgrade: {
              paymentId: args.paymentId,
              paymentMethod: args.paymentMethod,
              paymentAmount: args.paymentAmount,
              upgradedAt: now,
            },
            updatedAt: now,
          });
        }
      }

      return userSettings._id;
    }
  },
});

// Get user plan information
export const getUserPlan = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    return {
      plan: userSettings?.plan || "free",
      planUpdatedAt: userSettings?.planUpdatedAt,
    };
  },
});

// Delete all user data (for account deletion)
export const deleteAllUserData = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Delete in order to respect foreign key constraints
    // Start with child tables and work up to parent tables

    // 1. Delete messages (they belong to threads)
    const userThreads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const thread of userThreads) {
      // Delete messages for this thread
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete attachments for this thread
      const attachments = await ctx.db
        .query("attachments")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();

      for (const attachment of attachments) {
        await ctx.db.delete(attachment._id);
      }

      // Delete streams for this thread
      const streams = await ctx.db
        .query("streams")
        .withIndex("by_chat", (q) => q.eq("chatId", thread._id))
        .collect();

      for (const stream of streams) {
        await ctx.db.delete(stream._id);
      }
    }

    // 2. Delete threads
    for (const thread of userThreads) {
      await ctx.db.delete(thread._id);
    }

    // 3. Delete standalone attachments (not linked to threads)
    const standaloneAttachments = await ctx.db
      .query("attachments")
      .filter((q) => q.eq(q.field("threadId"), undefined))
      .collect();

    for (const attachment of standaloneAttachments) {
      await ctx.db.delete(attachment._id);
    }

    // 4. Delete usage records
    const usageRecords = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) => q.eq("userId", args.userId))
      .collect();

    for (const usage of usageRecords) {
      await ctx.db.delete(usage._id);
    }

    // 5. Delete user settings
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (userSettings) {
      await ctx.db.delete(userSettings._id);
    }

    // 6. Delete API keys
    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const apiKey of apiKeys) {
      await ctx.db.delete(apiKey._id);
    }

    return true;
  },
});

// Check if user has any data (for account deletion confirmation)
export const getUserDataSummary = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      return {
        threads: 0,
        messages: 0,
        attachments: 0,
        apiKeys: 0,
        hasData: false,
      } as const;
    }

    // Count user's data across all tables
    const threadsCount = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((threads) => threads.length);

    const messagesCount = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then(async (threads) => {
        let totalMessages = 0;
        for (const thread of threads) {
          const messages = await ctx.db
            .query("messages")
            .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
            .collect();
          totalMessages += messages.length;
        }
        return totalMessages;
      });

    const attachmentsCount = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then(async (threads) => {
        let totalAttachments = 0;
        for (const thread of threads) {
          const attachments = await ctx.db
            .query("attachments")
            .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
            .collect();
          totalAttachments += attachments.length;
        }
        return totalAttachments;
      });

    const apiKeysCount = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()
      .then((keys) => keys.length);

    return {
      threads: threadsCount,
      messages: messagesCount,
      attachments: attachmentsCount,
      apiKeys: apiKeysCount,
      hasData:
        threadsCount > 0 ||
        messagesCount > 0 ||
        attachmentsCount > 0 ||
        apiKeysCount > 0,
    };
  },
});
