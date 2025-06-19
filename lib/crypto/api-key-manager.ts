// Secure API key management with per-user encryption for AI providers

import {
  encryptApiKey,
  decryptApiKey,
  isEncryptionSupported,
  type EncryptedData,
} from "./encryption";
import { api } from "@/convex/_generated/api";
import type { ConvexHttpClient } from "convex/browser";

// AI provider configurations for BYOK (Bring Your Own Key) support
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

// Generate user-specific encryption key from Clerk user ID
export async function getUserEncryptionKey(userId: string): Promise<string> {
  return `${userId}-encryption-key-${process.env.NEXT_PUBLIC_CONVEX_URL}`;
}

// Encrypt API key for secure storage
export async function encryptUserApiKey(
  apiKey: string,
  userId: string,
): Promise<EncryptedData> {
  const encryptionKey = await getUserEncryptionKey(userId);
  return encryptApiKey(apiKey, encryptionKey);
}

// Decrypt API key from storage
export async function decryptUserApiKey(
  encryptedData: EncryptedData,
  userId: string,
): Promise<string> {
  const encryptionKey = await getUserEncryptionKey(userId);
  return decryptApiKey(encryptedData, encryptionKey);
}

// Validate API key format for provider
export function validateApiKey(provider: Provider, apiKey: string): boolean {
  const config = PROVIDER_CONFIGS[provider];
  return config.validateKey(apiKey);
}

// Test API key validity (currently format validation only)
export async function testApiKey(
  provider: Provider,
  apiKey: string,
): Promise<boolean> {
  return validateApiKey(provider, apiKey);
}

function cacheKey(provider: Provider, key: string): void {
  keyCache.set(provider, {
    key,
    timestamp: Date.now(),
  });
}

function getCachedKey(provider: Provider): string | null {
  const cached = keyCache.get(provider);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    keyCache.delete(provider);
    return null;
  }

  return cached.key;
}

export function clearKeyCache(): void {
  keyCache.clear();
}

// Get masked API key for display (shows first 8 chars)
export function getKeyPrefix(key: string): string {
  return key.length > 8 ? key.substring(0, 8) + "••••••••" : key;
}

// API Key Manager with Convex integration and encryption
export class ApiKeyManager {
  private isInitialized = false;
  private convexClient: ConvexHttpClient | null = null;
  private userId: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        clearKeyCache();
      });
    }
  }

  // Initialize manager with Convex client and user context
  async initialize(
    convexClient?: ConvexHttpClient,
    userId?: string,
  ): Promise<void> {
    if (!isEncryptionSupported()) {
      throw new Error("Encryption not supported in this environment");
    }

    if (convexClient) {
      this.convexClient = convexClient;
    }
    if (userId) {
      this.userId = userId;
    }

    this.isInitialized = true;
  }

  // Check if manager is ready for key operations
  getIsUnlocked(): boolean {
    return this.isInitialized && !!this.convexClient && !!this.userId;
  }

  // Get decrypted API key for provider with caching
  async getApiKey(provider: Provider): Promise<string | null> {
    if (!this.getIsUnlocked()) {
      return null;
    }

    // Check cache first
    const cachedKey = getCachedKey(provider);
    if (cachedKey) {
      return cachedKey;
    }

    try {
      // Query Convex for user's encrypted key metadata
      const userKeys = await this.convexClient!.query(
        api.apiKeys.getUserApiKeys,
      );
      const keyMeta = userKeys?.find((key) => key.provider === provider);

      if (!keyMeta) {
        return null;
      }

      // Get encrypted key data
      const encryptedKey = await this.convexClient!.query(
        api.apiKeys.getEncryptedApiKey,
        {
          keyId: keyMeta._id,
        },
      );

      if (!encryptedKey) {
        return null;
      }

      // Decrypt and cache the key
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

      cacheKey(provider, decryptedKey);
      return decryptedKey;
    } catch {
      return null;
    }
  }

  setCachedKey(provider: Provider, key: string): void {
    cacheKey(provider, key);
  }

  clearCache(): void {
    clearKeyCache();
  }

  // Set user context for server-side operations
  setUserContext(userId: string, convexClient?: ConvexHttpClient): void {
    this.userId = userId;
    if (convexClient) {
      this.convexClient = convexClient;
    }
  }
}

export const apiKeyManager = new ApiKeyManager();
