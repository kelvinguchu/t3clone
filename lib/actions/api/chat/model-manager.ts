import type { LanguageModelV1 } from "ai";
import {
  getModel,
  getModelConfig,
  getModelTools,
  validateProviderKeys,
  type ModelId,
} from "@/lib/ai-providers";

export interface ModelSetup {
  model: LanguageModelV1;
  modelConfig: ReturnType<typeof getModelConfig>;
  tools?: ReturnType<typeof getModelTools>;
  toolChoice?: "auto";
}

// Setup and validate model configuration
export function setupModelConfiguration(
  modelId: ModelId,
  enableWebBrowsing: boolean,
  requestId?: string,
): ModelSetup {
  const logPrefix = requestId ? `[${requestId}]` : "[setupModelConfiguration]";

  // Validate provider API keys
  validateProviderKeys();

  const modelConfig = getModelConfig(modelId);

  const model = getModel(modelId);

  // Validate that model was created successfully
  if (!model) {
    console.error(
      `${logPrefix} CHAT_API - Failed to create model instance for:`,
      modelId,
    );
    throw new Error(`Failed to create model instance for ${modelId}`);
  }

  // Get tools if web browsing is enabled
  const tools = enableWebBrowsing ? getModelTools(modelId) : undefined;
  const toolChoice = enableWebBrowsing && tools ? ("auto" as const) : undefined;

  return {
    model,
    modelConfig,
    tools,
    toolChoice,
  };
}
