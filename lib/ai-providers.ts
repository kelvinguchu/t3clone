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

// System provider instances for fallback when user keys unavailable

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

// Get provider instance with user API key if available, fallback to system
async function getProviderInstance(provider: Provider) {
  // Return cached instance if available
  if (providerInstances[provider]) {
    return providerInstances[provider];
  }

  try {
    // Attempt to get user's BYOK API key
    let userApiKey: string | null = null;

    if (apiKeyManager.getIsUnlocked()) {
      userApiKey = await apiKeyManager.getApiKey(provider);
    }

    // Create provider instance with user key or system fallback
    switch (provider) {
      case "groq": {
        const instance = userApiKey
          ? createGroq({ apiKey: userApiKey })
          : systemGroq;
        providerInstances[provider] = instance;
        return instance;
      }

      case "google": {
        const instance = userApiKey
          ? createGoogleGenerativeAI({ apiKey: userApiKey })
          : systemGoogle;
        providerInstances[provider] = instance;
        return instance;
      }

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch {
    // Fallback to system providers on error
    if (provider === "groq") {
      providerInstances[provider] = systemGroq;
      return systemGroq;
    } else if (provider === "google") {
      providerInstances[provider] = systemGoogle;
      return systemGoogle;
    }

    throw new Error(`Failed to create provider instance: ${provider}`);
  }
}

// Create model instance with user API key support and system fallback
export async function getModel(modelId: ModelId): Promise<LanguageModelV1> {
  const config = AI_MODELS[modelId];
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }

  // Get provider instance (with user key if available)
  const provider = await getProviderInstance(config.provider);

  // Create and return model instance
  return provider(config.modelName);
}

// Generate dynamic system prompt from user's customization preferences
export async function getDynamicSystemPrompt(
  userId?: string,
): Promise<string | undefined> {
  if (!userId) {
    return undefined;
  }

  try {
    // Import here to avoid circular dependencies
    const { fetchQuery } = await import("convex/nextjs");
    const { api } = await import("@/convex/_generated/api");

    const systemPrompt = await fetchQuery(
      api.userPreferences.generateSystemPrompt,
      { userId },
    );

    return systemPrompt || undefined;
  } catch {
    return undefined;
  }
}

// Synchronous model creation using system keys only
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

// Clear provider instances cache when user keys change
export function clearProviderCache(): void {
  if (providerInstances.groq) {
    delete providerInstances.groq;
  }
  if (providerInstances.google) {
    delete providerInstances.google;
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

// Get available tools for models that support tool calling
export function getModelTools(modelId: ModelId) {
  const config = AI_MODELS[modelId];
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }

  // Check if provider supports tool calling
  const providerConfig = PROVIDER_CONFIGS[config.provider];
  if (!providerConfig.supportsToolCalls) {
    return undefined;
  }

  // Verify Browserbase configuration is available
  const hasBrowserbaseConfig =
    process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID;

  if (!hasBrowserbaseConfig) {
    return undefined;
  }

  // Return available browsing tools
  return {
    createSession: createSessionTool,
    duckDuckGoSearch: duckDuckGoSearchTool,
    getPageContent: getPageContentTool,
  };
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
    defaultTemperature: 1.0,
    supportsStreaming: true,
    supportsToolCalls: true,
    maxRetries: 3,
    streamingBufferSize: 1,
    flushOnEveryToken: true,
  },
  google: {
    defaultTemperature: 1.0,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    supportsThinking: true,
    maxRetries: 3,
  },
} as const;
