import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";
import { apiKeyManager } from "./crypto/api-key-manager";
import {
  getPageContentTool,
  duckDuckGoSearchTool,
  createSessionTool,
} from "./tools/browser-tool";

// System providers (fallback when user doesn't have keys)
const systemGroq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

const systemGoogle = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Log system key availability at startup
console.log(`🏢 [AI Providers] System keys available:`, {
  groq: !!process.env.GROQ_API_KEY,
  google: !!process.env.GEMINI_API_KEY,
});

// Provider instances cache (will use user keys when available)
const providerInstances: {
  groq?: ReturnType<typeof createGroq>;
  google?: ReturnType<typeof createGoogleGenerativeAI>;
} = {};

// Model definitions with their respective providers
export const AI_MODELS = {
  // Groq models (support both system and user keys)
  "llama3-70b-8192": {
    provider: "groq" as const,
    modelName: "llama3-70b-8192",
    displayName: "Llama 3 70B",
    description: "Fast and efficient model by Meta via Groq",
    maxTokens: 8192,
    costPer1kTokens: { input: 0.05, output: 0.08 },
    capabilities: {
      vision: false,
      thinking: false,
      tools: true,
      fileAttachments: false,
      imageGeneration: false,
      multimodal: false,
      fastResponse: true,
      longContext: false,
    },
    icon: "/brand-icons/llama.svg",
    theme: "orange",
  },

  "deepseek-r1-distill-llama-70b": {
    provider: "groq" as const,
    modelName: "deepseek-r1-distill-llama-70b",
    displayName: "DeepSeek R1 Distill Llama 70B",
    description: "Fast model with thinking tokens by DeepSeek via Groq",
    maxTokens: 32768,
    costPer1kTokens: { input: 0.05, output: 0.08 },
    capabilities: {
      vision: false,
      thinking: true,
      tools: true,
      fileAttachments: false,
      imageGeneration: false,
      multimodal: false,
      fastResponse: true,
      longContext: true,
    },
    icon: "/brand-icons/deepseek.svg",
    theme: "blue",
  },

  "qwen/qwen3-32b": {
    provider: "groq" as const,
    modelName: "qwen/qwen3-32b",
    displayName: "Qwen 3 32B",
    description: "Advanced reasoning model by Qwen via Groq",
    maxTokens: 32768,
    costPer1kTokens: { input: 0.05, output: 0.08 },
    capabilities: {
      vision: false,
      thinking: true,
      tools: true,
      fileAttachments: false,
      imageGeneration: false,
      multimodal: false,
      fastResponse: true,
      longContext: true,
    },
    icon: "/brand-icons/qwen.svg",
    theme: "purple",
  },

  // Google Gemini models (support both system and user keys)
  "gemini-2.0-flash": {
    provider: "google" as const,
    modelName: "gemini-2.0-flash-001",
    displayName: "Gemini 2.0 Flash",
    description: "Google's latest multimodal model",
    maxTokens: 1000000,
    costPer1kTokens: { input: 0.075, output: 0.3 },
    capabilities: {
      vision: true,
      thinking: true,
      tools: true,
      fileAttachments: true,
      imageGeneration: false,
      multimodal: true,
      fastResponse: false,
      longContext: true,
    },
    icon: "/brand-icons/gemini.svg",
    theme: "blue",
  },

  "gemini-2.0-flash-preview-image-generation": {
    provider: "google" as const,
    modelName: "gemini-2.0-flash-preview-image-generation",
    displayName: "Gemini 2.0 Flash Image Gen",
    description: "Google's image generation model",
    maxTokens: 1000000,
    costPer1kTokens: { input: 0.075, output: 0.3 },
    capabilities: {
      vision: true,
      thinking: true,
      tools: false,
      fileAttachments: true,
      imageGeneration: true,
      multimodal: true,
      fastResponse: false,
      longContext: true,
    },
    icon: "/brand-icons/gemini.svg",
    theme: "purple",
  },
} as const;

// Type definitions
export type ModelId = keyof typeof AI_MODELS;
export type Provider = "groq" | "google";

export interface ModelConfig {
  provider: Provider;
  modelName: string;
  displayName: string;
  description: string;
  maxTokens: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  capabilities: {
    vision: boolean;
    thinking: boolean;
    tools: boolean;
    fileAttachments: boolean;
    imageGeneration: boolean;
    multimodal: boolean;
    fastResponse: boolean;
    longContext: boolean;
  };
  icon: string;
  theme: string;
}

/**
 * Get provider instance (with user API key if available, fallback to system)
 */
async function getProviderInstance(provider: Provider) {
  console.log(`[AI Providers] Getting provider instance for: ${provider}`);

  // Check if we already have a cached instance
  if (providerInstances[provider]) {
    console.log(`[AI Providers] Using cached ${provider} instance`);
    return providerInstances[provider];
  }

  try {
    // Try to get user API key first
    let userApiKey: string | null = null;

    console.log(`[AI Providers] Checking if API key manager is unlocked...`);
    if (apiKeyManager.getIsUnlocked()) {
      console.log(
        `[AI Providers] API key manager is unlocked, checking for user ${provider} key...`,
      );
      userApiKey = await apiKeyManager.getApiKey(provider);

      if (userApiKey) {
        console.log(
          `✅ [AI Providers] Found user BYOK key for ${provider} (${userApiKey.substring(0, 8)}...)`,
        );
      } else {
        console.log(
          `⚠️ [AI Providers] No user BYOK key found for ${provider}, will use system key`,
        );
      }
    } else {
      console.log(
        `⚠️ [AI Providers] API key manager is locked, will use system key for ${provider}`,
      );
    }

    switch (provider) {
      case "groq": {
        const instance = userApiKey
          ? createGroq({ apiKey: userApiKey })
          : systemGroq;

        if (userApiKey) {
          console.log(
            `🔑 [AI Providers] Created ${provider} instance with user BYOK key`,
          );
        } else {
          console.log(
            `🏢 [AI Providers] Created ${provider} instance with system key`,
          );
        }

        providerInstances[provider] = instance;
        return instance;
      }

      case "google": {
        const instance = userApiKey
          ? createGoogleGenerativeAI({ apiKey: userApiKey })
          : systemGoogle;

        if (userApiKey) {
          console.log(
            `🔑 [AI Providers] Created ${provider} instance with user BYOK key`,
          );
        } else {
          console.log(
            `🏢 [AI Providers] Created ${provider} instance with system key`,
          );
        }

        providerInstances[provider] = instance;
        return instance;
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error) {
    console.error(
      `❌ [AI Providers] Failed to create ${provider} instance:`,
      error,
    );

    // For providers that support system fallback
    if (provider === "groq") {
      console.log(
        `🔄 [AI Providers] Falling back to system ${provider} key due to error`,
      );
      providerInstances[provider] = systemGroq;
      return systemGroq;
    } else if (provider === "google") {
      console.log(
        `🔄 [AI Providers] Falling back to system ${provider} key due to error`,
      );
      providerInstances[provider] = systemGoogle;
      return systemGoogle;
    }

    throw error;
  }
}

/**
 * Enhanced model factory function with user API key support
 */
export async function getModel(modelId: ModelId): Promise<LanguageModelV1> {
  console.log(`[AI Providers] Creating model instance for: ${modelId}`);

  const config = AI_MODELS[modelId];
  if (!config) {
    console.error(`❌ [AI Providers] Model ${modelId} not found`);
    throw new Error(`Model ${modelId} not found`);
  }

  console.log(
    `[AI Providers] Model ${modelId} uses provider: ${config.provider}`,
  );

  // Get provider instance (with user key if available)
  const provider = await getProviderInstance(config.provider);

  // Create model instance
  console.log(
    `[AI Providers] Creating ${modelId} model instance with ${config.modelName}`,
  );
  const model = provider(config.modelName);

  console.log(
    `✅ [AI Providers] Successfully created ${modelId} model instance`,
  );
  return model;
}

/**
 * Synchronous version for cases where user keys aren't needed
 */
export function getModelSync(modelId: ModelId): LanguageModelV1 {
  const config = AI_MODELS[modelId];
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }

  // Use system providers only
  switch (config.provider) {
    case "groq":
      return systemGroq(config.modelName);
    case "google":
      return systemGoogle(config.modelName);
  }
}

/**
 * Clear provider instances cache (call when user keys change)
 */
export function clearProviderCache(): void {
  console.log(`🗑️ [AI Providers] Clearing provider cache (user keys changed)`);

  const clearedProviders = [];
  if (providerInstances.groq) {
    delete providerInstances.groq;
    clearedProviders.push("groq");
  }
  if (providerInstances.google) {
    delete providerInstances.google;
    clearedProviders.push("google");
  }

  if (clearedProviders.length > 0) {
    console.log(
      `🗑️ [AI Providers] Cleared cached instances for: ${clearedProviders.join(", ")}`,
    );
  } else {
    console.log(`🗑️ [AI Providers] No cached instances to clear`);
  }
}

// Get model configuration
export function getModelConfig(modelId: ModelId): ModelConfig {
  const config = AI_MODELS[modelId];
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }

  return config;
}

// Get available models for a user (can be extended with user tier logic)
export function getAvailableModels(): ModelId[] {
  return Object.keys(AI_MODELS) as ModelId[];
}

// Get models by provider
export function getModelsByProvider(provider: Provider): ModelId[] {
  return Object.entries(AI_MODELS)
    .filter(([, config]) => config.provider === provider)
    .map(([id]) => id as ModelId);
}

// Get model info for UI (used by components)
export function getModelInfo(modelId: ModelId) {
  const config = getModelConfig(modelId);
  return {
    name: config.displayName,
    icon: config.icon,
    theme: config.theme,
    description: config.description,
    capabilities: config.capabilities,
  };
}

// Get available tools for a model
export function getModelTools(modelId: ModelId) {
  const config = AI_MODELS[modelId];
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }

  console.log("[getModelTools] Checking tool availability:", {
    modelId,
    supportsTools: config.capabilities.tools,
    timestamp: new Date().toISOString(),
  });

  // Only return tools for models that support tool calling
  const providerConfig = PROVIDER_CONFIGS[config.provider];
  if (!providerConfig.supportsToolCalls) {
    console.log("[getModelTools] Provider does not support tool calls:", {
      modelId,
      provider: config.provider,
      timestamp: new Date().toISOString(),
    });
    return undefined;
  }

  // Check if Browserbase is configured
  const hasBrowserbaseConfig =
    process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID;

  console.log("[getModelTools] Browserbase configuration check:", {
    modelId,
    hasBrowserbaseApiKey: !!process.env.BROWSERBASE_API_KEY,
    hasBrowserbaseProjectId: !!process.env.BROWSERBASE_PROJECT_ID,
    hasBrowserbaseConfig,
    timestamp: new Date().toISOString(),
  });

  if (!hasBrowserbaseConfig) {
    console.warn(
      "[getModelTools] Browserbase not configured - tools unavailable:",
      {
        modelId,
        timestamp: new Date().toISOString(),
      },
    );
    return undefined;
  }

  const tools = {
    createSession: createSessionTool,
    duckDuckGoSearch: duckDuckGoSearchTool,
    getPageContent: getPageContentTool,
  };

  console.log("[getModelTools] Tools available:", {
    modelId,
    toolNames: Object.keys(tools),
    timestamp: new Date().toISOString(),
  });

  return tools;
}

// Validate environment variables
export function validateProviderKeys() {
  const missing = [];

  if (!process.env.GROQ_API_KEY) {
    missing.push("GROQ_API_KEY");
  }

  if (!process.env.GEMINI_API_KEY) {
    missing.push("GEMINI_API_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

export const PROVIDER_CONFIGS = {
  groq: {
    defaultTemperature: 0.7,
    supportsStreaming: true,
    supportsToolCalls: true,
    maxRetries: 3,
    streamingBufferSize: 1,
    flushOnEveryToken: true,
  },
  google: {
    defaultTemperature: 0.7,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    supportsThinking: true,
    maxRetries: 3,
  },
} as const;
