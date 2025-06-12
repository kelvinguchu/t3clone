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
      defaultModel: "gpt-4",
      theme: "system",
      enableWebSearch: false,
      enableImageGeneration: false,
      hasCustomOpenAI: false,
      hasCustomAnthropic: false,
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
    hasCustomOpenAI: v.optional(v.boolean()),
    hasCustomAnthropic: v.optional(v.boolean()),
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
        hasCustomOpenAI: args.hasCustomOpenAI || false,
        hasCustomAnthropic: args.hasCustomAnthropic || false,
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
        hasCustomOpenAI?: boolean;
        hasCustomAnthropic?: boolean;
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
      if (args.hasCustomOpenAI !== undefined)
        updates.hasCustomOpenAI = args.hasCustomOpenAI;
      if (args.hasCustomAnthropic !== undefined)
        updates.hasCustomAnthropic = args.hasCustomAnthropic;

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
