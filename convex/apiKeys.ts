import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Supported providers for API keys
const SUPPORTED_PROVIDERS = ["groq", "google"] as const;

// Store encrypted API key
export const storeApiKey = mutation({
  args: {
    provider: v.union(v.literal("groq"), v.literal("google")),
    encryptedData: v.string(),
    iv: v.string(),
    salt: v.string(),
    algorithm: v.string(),
    iterations: v.number(),
    keyName: v.optional(v.string()),
    keyPrefix: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const now = Date.now();

    // Check if user already has an active key for this provider
    const existingKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", identity.subject).eq("provider", args.provider),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    if (existingKey) {
      // Deactivate existing key
      await ctx.db.patch(existingKey._id, {
        isActive: false,
        updatedAt: now,
      });
    }

    // Store new encrypted key
    const keyId = await ctx.db.insert("apiKeys", {
      userId: identity.subject,
      provider: args.provider,
      encryptedData: args.encryptedData,
      iv: args.iv,
      salt: args.salt,
      algorithm: args.algorithm,
      iterations: args.iterations,
      keyName: args.keyName,
      keyPrefix: args.keyPrefix,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return keyId;
  },
});

// Get user's encrypted API keys (metadata only, not the actual keys)
export const getUserApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // Return metadata only (no encrypted data)
    return keys.map((key) => ({
      _id: key._id,
      provider: key.provider,
      keyName: key.keyName,
      keyPrefix: key.keyPrefix,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
    }));
  },
});

// Get encrypted data for a specific API key (for decryption on client)
export const getEncryptedApiKey = query({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== identity.subject) {
      throw new Error("API key not found or unauthorized");
    }

    // Return encryption data for client-side decryption
    return {
      provider: key.provider,
      encryptedData: key.encryptedData,
      iv: key.iv,
      salt: key.salt,
      algorithm: key.algorithm,
      iterations: key.iterations,
    };
  },
});

// Update API key usage timestamp
export const updateKeyUsage = mutation({
  args: {
    provider: v.union(v.literal("groq"), v.literal("google")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return; // Silently fail for usage tracking
    }

    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", identity.subject).eq("provider", args.provider),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    if (key) {
      await ctx.db.patch(key._id, {
        lastUsed: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Delete API key
export const deleteApiKey = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== identity.subject) {
      throw new Error("API key not found or unauthorized");
    }

    await ctx.db.delete(args.keyId);
    return { success: true };
  },
});

// Check if user has API key for specific provider
export const hasApiKeyForProvider = query({
  args: {
    provider: v.union(v.literal("groq"), v.literal("google")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", identity.subject).eq("provider", args.provider),
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .unique();

    return !!key;
  },
});

// Get provider statistics (for UI display)
export const getProviderStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return SUPPORTED_PROVIDERS.map((provider) => ({
        provider,
        hasKey: false,
        lastUsed: null,
      }));
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    return SUPPORTED_PROVIDERS.map((provider) => {
      const key = keys.find((k) => k.provider === provider);
      return {
        provider,
        hasKey: !!key,
        lastUsed: key?.lastUsed || null,
      };
    });
  },
});
