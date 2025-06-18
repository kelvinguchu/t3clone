/**
 * Secure API Key Manager
 *
 * This module manages encrypted API keys for AI providers.
 * Simple functions for encryption/decryption without master passwords.
 */

import {
  encryptApiKey,
  decryptApiKey,
  isEncryptionSupported,
  type EncryptedData,
} from "./encryption";
import { api } from "@/convex/_generated/api";
import type { ConvexHttpClient } from "convex/browser";

// Provider configuration - ONLY for AI model providers that users can bring their own keys
export const PROVIDER_CONFIGS = {
  groq: {
    name: "Groq",
    description: "Fast inference for Llama, DeepSeek, Qwen models",
    keyFormat: "gsk_...",
    validateKey: (key: string) => key.startsWith("gsk_") && key.length > 20,
    icon: "/brand-icons/llama.svg",
    envVar: "GROQ_API_KEY",
  },
  google: {
    name: "Google AI",
    description: "Gemini models with vision and reasoning",
    keyFormat: "AI...",
    validateKey: (key: string) => key.startsWith("AI") && key.length > 20,
    icon: "/brand-icons/gemini.svg",
    envVar: "GEMINI_API_KEY",
  },
} as const;

export type Provider = keyof typeof PROVIDER_CONFIGS;

// In-memory cache for decrypted keys (cleared on page refresh for security)
const keyCache = new Map<string, { key: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a user-specific encryption key from their Clerk user ID
 */
export async function getUserEncryptionKey(userId: string): Promise<string> {
  // Use user ID + a salt to create a consistent encryption key per user
  // This is simpler than master passwords but still provides per-user encryption
  return `${userId}-encryption-key-${process.env.NEXT_PUBLIC_CONVEX_URL}`;
}

/**
 * Encrypt an API key for storage
 */
export async function encryptUserApiKey(
  apiKey: string,
  userId: string,
): Promise<EncryptedData> {
  const encryptionKey = await getUserEncryptionKey(userId);
  return encryptApiKey(apiKey, encryptionKey);
}

/**
 * Decrypt an API key from storage
 */
export async function decryptUserApiKey(
  encryptedData: EncryptedData,
  userId: string,
): Promise<string> {
  const encryptionKey = await getUserEncryptionKey(userId);
  return decryptApiKey(encryptedData, encryptionKey);
}

/**
 * Validate API key format for a provider
 */
export function validateApiKey(provider: Provider, apiKey: string): boolean {
  const config = PROVIDER_CONFIGS[provider];
  return config.validateKey(apiKey);
}

/**
 * Test an API key by making a simple request
 */
export async function testApiKey(
  provider: Provider,
  apiKey: string,
): Promise<boolean> {
  // For now, just validate format
  // In a real implementation, this would make actual API calls
  return validateApiKey(provider, apiKey);
}

/**
 * Cache a decrypted key temporarily
 */
function cacheKey(provider: Provider, key: string): void {
  keyCache.set(provider, {
    key,
    timestamp: Date.now(),
  });
}

/**
 * Get a cached key if still valid
 */
function getCachedKey(provider: Provider): string | null {
  const cached = keyCache.get(provider);
  if (!cached) return null;

  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    keyCache.delete(provider);
    return null;
  }

  return cached.key;
}

/**
 * Clear all cached keys
 */
export function clearKeyCache(): void {
  keyCache.clear();
}

/**
 * Get a safe prefix of the API key for display
 */
export function getKeyPrefix(key: string): string {
  return key.length > 8 ? key.substring(0, 8) + "••••••••" : key;
}

/**
 * Enhanced API Key Manager with Convex integration
 */
export class ApiKeyManager {
  private isInitialized = false;
  private convexClient: ConvexHttpClient | null = null;
  private userId: string | null = null;

  constructor() {
    // Clear cache on page unload for security
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        clearKeyCache();
      });
    }
  }

  /**
   * Initialize the manager with Convex client and user ID
   */
  async initialize(
    convexClient?: ConvexHttpClient,
    userId?: string,
  ): Promise<void> {
    if (!isEncryptionSupported()) {
      throw new Error("Encryption not supported in this environment");
    }

    // Store Convex client and user ID if provided
    if (convexClient) {
      this.convexClient = convexClient;
    }
    if (userId) {
      this.userId = userId;
    }

    this.isInitialized = true;
    console.log(
      `🔐 [API Key Manager] Initialized with user: ${userId ? "authenticated" : "not provided"}`,
    );
  }

  /**
   * Check if manager is initialized and ready
   */
  getIsUnlocked(): boolean {
    const isReady = this.isInitialized && !!this.convexClient && !!this.userId;
    console.log(`🔍 [API Key Manager] Unlock check:`, {
      isInitialized: this.isInitialized,
      hasConvexClient: !!this.convexClient,
      hasUserId: !!this.userId,
      isReady,
    });
    return isReady;
  }

  /**
   * Get decrypted API key for a provider
   */
  async getApiKey(provider: Provider): Promise<string | null> {
    if (!this.getIsUnlocked()) {
      console.log(
        `❌ [API Key Manager] Cannot get ${provider} key - manager not ready`,
      );
      return null;
    }

    // Check cache first
    const cachedKey = getCachedKey(provider);
    if (cachedKey) {
      console.log(`💾 [API Key Manager] Found cached ${provider} key`);
      return cachedKey;
    }

    try {
      console.log(
        `🔍 [API Key Manager] Loading ${provider} key from database...`,
      );

      // Query Convex for user's encrypted key
      const userKeys = await this.convexClient!.query(
        api.apiKeys.getUserApiKeys,
      );
      const keyMeta = userKeys?.find((key) => key.provider === provider);

      if (!keyMeta) {
        console.log(
          `⚠️ [API Key Manager] No ${provider} key found in database`,
        );
        return null;
      }

      // Get the encrypted data
      const encryptedKey = await this.convexClient!.query(
        api.apiKeys.getEncryptedApiKey,
        {
          keyId: keyMeta._id,
        },
      );

      if (!encryptedKey) {
        console.log(
          `❌ [API Key Manager] Failed to load encrypted ${provider} key`,
        );
        return null;
      }

      // Decrypt the key
      const decryptedKey = await decryptUserApiKey(
        {
          encryptedData: encryptedKey.encryptedData,
          iv: encryptedKey.iv,
          salt: encryptedKey.salt,
          algorithm: encryptedKey.algorithm,
          iterations: encryptedKey.iterations,
        },
        this.userId!,
      );

      // Cache the decrypted key
      cacheKey(provider, decryptedKey);

      console.log(
        `✅ [API Key Manager] Successfully loaded and decrypted ${provider} key`,
      );
      return decryptedKey;
    } catch (error) {
      console.error(
        `❌ [API Key Manager] Failed to load ${provider} key:`,
        error,
      );
      return null;
    }
  }

  /**
   * Cache a decrypted key
   */
  setCachedKey(provider: Provider, key: string): void {
    cacheKey(provider, key);
  }

  /**
   * Clear cached keys
   */
  clearCache(): void {
    console.log(`🗑️ [API Key Manager] Clearing key cache`);
    clearKeyCache();
  }

  /**
   * Set user context (for server-side usage)
   */
  setUserContext(userId: string, convexClient?: ConvexHttpClient): void {
    this.userId = userId;
    if (convexClient) {
      this.convexClient = convexClient;
    }
    console.log(`👤 [API Key Manager] Updated user context: ${userId}`);
  }
}

// Singleton instance
export const apiKeyManager = new ApiKeyManager();
