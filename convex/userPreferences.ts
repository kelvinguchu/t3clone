import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user's enabled models
export const getEnabledModels = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Return enabled models or null if no preferences set (client will use defaults)
    return userSettings?.enabledModels || null;
  },
});

// Set user's enabled models
export const setEnabledModels = mutation({
  args: {
    userId: v.string(),
    enabledModels: v.array(v.string()),
  },
  handler: async (ctx, { userId, enabledModels }) => {
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        enabledModels,
        updatedAt: now,
      });
    } else {
      // Create new settings with defaults
      await ctx.db.insert("userSettings", {
        userId,
        defaultModel: "gemini-2.0-flash", // Default model
        enabledModels,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

// Reset user's enabled models to all available
export const resetEnabledModels = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    if (existingSettings) {
      // Remove enabledModels field to use defaults
      await ctx.db.patch(existingSettings._id, {
        enabledModels: undefined,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

// Toggle a specific model for a user
export const toggleModel = mutation({
  args: {
    userId: v.string(),
    modelId: v.string(),
  },
  handler: async (ctx, { userId, modelId }) => {
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();
    let currentEnabledModels: string[] = [];

    if (existingSettings?.enabledModels) {
      currentEnabledModels = existingSettings.enabledModels;
    } else {
      // If no preferences exist, assume all models are enabled by default
      // This will be handled by the client's default logic
      currentEnabledModels = [
        "llama3-70b-8192",
        "deepseek-r1-distill-llama-70b",
        "qwen/qwen3-32b",
        "gemini-2.0-flash",
        "gemini-2.0-flash-preview-image-generation",
      ];
    }

    // Toggle the model
    const modelIndex = currentEnabledModels.indexOf(modelId);
    if (modelIndex === -1) {
      // Model not in list, add it
      currentEnabledModels.push(modelId);
    } else {
      // Model in list, remove it (but ensure at least one model remains)
      if (currentEnabledModels.length > 1) {
        currentEnabledModels.splice(modelIndex, 1);
      }
    }

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        enabledModels: currentEnabledModels,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        defaultModel: "gemini-2.0-flash",
        enabledModels: currentEnabledModels,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      success: true,
      enabledModels: currentEnabledModels,
      isEnabled: currentEnabledModels.includes(modelId),
    };
  },
});
