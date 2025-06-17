import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";
// Note: extractReasoningMiddleware not needed for Groq - they have native reasoning support
import {
  getPageContentTool,
  duckDuckGoSearchTool,
  createSessionTool,
} from "./tools/browser-tool";

// Create Google provider with custom API key
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Model definitions with their respective providers
export const AI_MODELS = {
  // Groq models (Llama via Groq)
  "llama3-70b-8192": {
    provider: "groq",
    model: groq("llama3-70b-8192"),
    displayName: "Llama 3 70B",
    description: "Fast and efficient model by Meta via Groq",
    maxTokens: 8192,
    costPer1kTokens: { input: 0.05, output: 0.08 },
    capabilities: ["text", "chat", "tools"],
    icon: "/brand-icons/llama.svg",
    theme: "orange",
  },

  "deepseek-r1-distill-llama-70b": {
    provider: "groq",
    model: groq("deepseek-r1-distill-llama-70b"),
    displayName: "DeepSeek R1 Distill Llama 70B",
    description: "Fast model with thinking tokens by DeepSeek via Groq",
    maxTokens: 32768,
    costPer1kTokens: { input: 0.05, output: 0.08 },
    capabilities: ["text", "chat", "tools", "reasoning"],
    icon: "/brand-icons/deepseek.svg",
    theme: "blue",
  },

  "qwen/qwen3-32b": {
    provider: "groq",
    model: groq("qwen/qwen3-32b"),
    displayName: "Qwen 3 32B",
    description: "Advanced reasoning model by Qwen via Groq",
    maxTokens: 32768,
    costPer1kTokens: { input: 0.05, output: 0.08 },
    capabilities: ["text", "chat", "tools", "reasoning"],
    icon: "/brand-icons/qwen.svg",
    theme: "purple",
  },

  // Google Gemini models
  "gemini-2.0-flash": {
    provider: "google",
    model: google("gemini-2.0-flash-001"),
    displayName: "Gemini 2.0 Flash",
    description: "Google's latest multimodal model",
    maxTokens: 1000000,
    costPer1kTokens: { input: 0.075, output: 0.3 },
    capabilities: ["text", "chat", "vision", "multimodal", "tools"],
    icon: "/brand-icons/gemini.svg",
    theme: "blue",
  },

  "gemini-2.0-flash-preview-image-generation": {
    provider: "google",
    model: google("gemini-2.0-flash-preview-image-generation"),
    displayName: "Gemini 2.0 Flash Image Gen",
    description: "Google's image generation model",
    maxTokens: 1000000,
    costPer1kTokens: { input: 0.075, output: 0.3 },
    capabilities: [
      "text",
      "chat",
      "vision",
      "multimodal",
      "tools",
      "image-generation",
    ],
    icon: "/brand-icons/gemini.svg",
    theme: "purple",
  },

  // OpenAI models
  "gpt-4.1-mini": {
    provider: "openai",
    model: openai("gpt-4.1-mini"),
    displayName: "GPT-4.1 Mini",
    description: "Efficient & intelligent responses",
    maxTokens: 128000,
    costPer1kTokens: { input: 0.15, output: 0.6 },
    capabilities: ["text", "chat", "vision", "tools"],
    icon: "/brand-icons/openai.svg",
    theme: "green",
  },
} as const;

// Type definitions
export type ModelId = keyof typeof AI_MODELS;
export type Provider = "groq" | "google" | "openai";

export interface ModelConfig {
  provider: Provider;
  model: LanguageModelV1;
  displayName: string;
  description: string;
  maxTokens: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  capabilities: readonly (
    | "text"
    | "chat"
    | "vision"
    | "multimodal"
    | "tools"
    | "image-generation"
    | "reasoning"
  )[];
  icon: string;
  theme: string;
}

// Enhanced model factory function - Groq has native reasoning support, no middleware needed
export function getModel(modelId: ModelId): LanguageModelV1 {
  const config = AI_MODELS[modelId];
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }

  // Groq reasoning models have native support via providerOptions, no middleware needed
  // Only use extractReasoningMiddleware for third-party providers that output raw <think> tags
  return config.model;
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

  // Only return tools for models that support tool calling
  const providerConfig = PROVIDER_CONFIGS[config.provider];
  if (!providerConfig.supportsToolCalls) {
    return undefined;
  }

  // Check if Browserbase is configured
  const hasBrowserbaseConfig =
    process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID;

  if (!hasBrowserbaseConfig) {
    return undefined;
  }

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

  if (!process.env.OPENAI_API_KEY) {
    missing.push("OPENAI_API_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

// Provider-specific configurations for advanced features
export const PROVIDER_CONFIGS = {
  groq: {
    // Groq-specific settings
    defaultTemperature: 0.7,
    supportsStreaming: true,
    supportsToolCalls: true,
    maxRetries: 3,
    // Groq streaming optimizations to prevent hangs
    streamingBufferSize: 1, // Force smaller buffer chunks
    flushOnEveryToken: true, // Ensure tokens are flushed immediately
  },
  google: {
    // Google-specific settings
    defaultTemperature: 0.7,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    supportsThinking: true,
    maxRetries: 3,
  },
  openai: {
    // OpenAI-specific settings
    defaultTemperature: 0.7,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    maxRetries: 3,
  },
} as const;
