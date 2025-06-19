import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

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

// Get user's customization preferences
export const getCustomizationPreferences = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      userName: userSettings?.userName || "",
      userRole: userSettings?.userRole || "",
      traits: userSettings?.traits || [],
      additionalInfo: userSettings?.additionalInfo || "",
    };
  },
});

// Update user's customization preferences
export const updateCustomizationPreferences = mutation({
  args: {
    userId: v.string(),
    userName: v.optional(v.string()),
    userRole: v.optional(v.string()),
    traits: v.optional(v.array(v.string())),
    additionalInfo: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { userId, userName, userRole, traits, additionalInfo },
  ) => {
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();

    // Validate traits (max 50 traits, each max 100 characters)
    if (traits) {
      if (traits.length > 50) {
        throw new Error("Maximum 50 traits allowed");
      }
      for (const trait of traits) {
        if (trait.length > 100) {
          throw new Error("Each trait must be 100 characters or less");
        }
      }
    }

    // Validate userName (max 50 characters)
    if (userName && userName.length > 50) {
      throw new Error("Name must be 50 characters or less");
    }

    // Validate userRole (max 100 characters)
    if (userRole && userRole.length > 100) {
      throw new Error("Role must be 100 characters or less");
    }

    const updates: Partial<Doc<"userSettings">> = {};

    if (userName !== undefined) updates.userName = userName || undefined;
    if (userRole !== undefined) updates.userRole = userRole || undefined;
    if (traits !== undefined)
      updates.traits = traits.length > 0 ? traits : undefined;
    if (additionalInfo !== undefined)
      updates.additionalInfo = additionalInfo || undefined;

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, { ...updates, updatedAt: now });
    } else {
      // Create new settings with defaults
      await ctx.db.insert("userSettings", {
        userId,
        defaultModel: "gemini-2.0-flash",
        ...updates,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

// Generate system prompt from user customization preferences
export const generateSystemPrompt = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const userSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // If no customization preferences are set, return null (use default behavior)
    if (
      !userSettings?.userName &&
      !userSettings?.userRole &&
      (!userSettings?.traits || userSettings.traits.length === 0) &&
      !userSettings?.additionalInfo
    ) {
      return null;
    }

    // Build system prompt from user preferences
    const promptParts: string[] = [];

    if (userSettings?.userName) {
      promptParts.push(
        `The user's name is ${userSettings.userName}. Greet them by name in your first reply, then avoid repeating the name in every message unless it feels natural.`,
      );
    }

    if (userSettings?.userRole) {
      promptParts.push(`Their profession / role is: ${userSettings.userRole}.`);
    }

    if (userSettings?.traits && userSettings.traits.length > 0) {
      promptParts.push(
        `Embody these traits: ${userSettings.traits.join(", ")}.`,
      );
    }

    if (userSettings?.additionalInfo) {
      promptParts.push(`Keep this in mind: ${userSettings.additionalInfo}.`);
    }

    promptParts.push(
      "When appropriate, greet the user by name and incorporate their preferences. Be helpful, accurate, and maintain a conversational tone.",
    );

    return promptParts.join(" ");
  },
});
