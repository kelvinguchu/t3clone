import { groq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

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
    capabilities: ["text", "chat"],
    icon: "/brand-icons/llama.svg",
    theme: "orange",
  },

  // Google Gemini models
  "gemini-2.0-flash": {
    provider: "google",
    model: google("gemini-2.0-flash-exp"),
    displayName: "Gemini 2.0 Flash",
    description: "Google's latest multimodal model",
    maxTokens: 1000000,
    costPer1kTokens: { input: 0.075, output: 0.3 },
    capabilities: ["text", "chat", "vision", "multimodal"],
    icon: "/brand-icons/gemini.svg",
    theme: "blue",
  },

  // OpenAI models
  "gpt-4.1-mini": {
    provider: "openai",
    model: openai("gpt-4.1-mini"),
    displayName: "GPT-4.1 Mini",
    description: "Efficient & intelligent responses",
    maxTokens: 128000,
    costPer1kTokens: { input: 0.15, output: 0.6 },
    capabilities: ["text", "chat", "vision"],
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
  capabilities: readonly string[];
  icon: string;
  theme: string;
}

// Provider factory function - returns the configured model
export function getModel(modelId: ModelId): LanguageModelV1 {
  const config = AI_MODELS[modelId];
  if (!config) {
    throw new Error(`Model ${modelId} not found`);
  }

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
