import type { LanguageModelV1 } from "ai";
import {
  getModel,
  getModelConfig,
  getModelTools,
  validateProviderKeys,
  type ModelId,
} from "@/lib/ai-providers";
import { apiKeyManager } from "@/lib/crypto/api-key-manager";
import { ConvexHttpClient } from "convex/browser";

export interface ModelSetup {
  model: LanguageModelV1;
  modelConfig: ReturnType<typeof getModelConfig>;
  tools?: ReturnType<typeof getModelTools>;
  toolChoice?: "auto";
}

// Configure model instance with user keys, tools, and validation
export async function setupModelConfiguration(
  modelId: ModelId,
  enableWebBrowsing: boolean,
  userId?: string,
  fetchOptions?: { token: string },
): Promise<ModelSetup> {
  // Initialize API key manager for authenticated users
  if (userId && fetchOptions?.token) {
    try {
      // Create server-side Convex client with auth token
      const convexClient = new ConvexHttpClient(
        process.env.NEXT_PUBLIC_CONVEX_URL!,
      );
      convexClient.setAuth(fetchOptions.token);

      // Initialize API key manager for BYOK support
      await apiKeyManager.initialize(convexClient, userId);
    } catch {
      // Continue without user keys - will fall back to system keys
    }
  }

  // Validate system provider keys are available
  validateProviderKeys();

  // Get model configuration and create instance
  const modelConfig = getModelConfig(modelId);
  const model = await getModel(modelId);

  if (!model) {
    throw new Error(`Failed to create model instance for ${modelId}`);
  }

  // Configure tools for web browsing if enabled
  const tools = enableWebBrowsing ? getModelTools(modelId) : undefined;
  const toolChoice = enableWebBrowsing && tools ? ("auto" as const) : undefined;

  return {
    model,
    modelConfig,
    tools,
    toolChoice,
  };
}
