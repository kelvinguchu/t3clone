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

// Setup and validate model configuration
export async function setupModelConfiguration(
  modelId: ModelId,
  enableWebBrowsing: boolean,
  userId?: string,
  fetchOptions?: { token: string },
  requestId?: string,
): Promise<ModelSetup> {
  const logPrefix = requestId ? `[${requestId}]` : "[setupModelConfiguration]";

  console.log(`${logPrefix} Setting up model configuration:`, {
    modelId,
    enableWebBrowsing,
    hasUserId: !!userId,
    hasToken: !!fetchOptions?.token,
    timestamp: new Date().toISOString(),
  });

  // Initialize API key manager with server-side Convex client if user is authenticated
  if (userId && fetchOptions?.token) {
    try {
      console.log(
        `${logPrefix} Initializing API key manager for user: ${userId}`,
      );

      // Create server-side Convex client
      const convexClient = new ConvexHttpClient(
        process.env.NEXT_PUBLIC_CONVEX_URL!,
      );
      convexClient.setAuth(fetchOptions.token);

      // Initialize the API key manager
      await apiKeyManager.initialize(convexClient, userId);

      console.log(`${logPrefix} API key manager initialized successfully`);
    } catch (error) {
      console.error(
        `${logPrefix} Failed to initialize API key manager:`,
        error,
      );
      // Continue without user keys - will fall back to system keys
    }
  } else {
    console.log(`${logPrefix} No user authentication - using system keys only`);
  }

  // Validate provider API keys
  validateProviderKeys();

  const modelConfig = getModelConfig(modelId);

  const model = await getModel(modelId);

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

  console.log(`${logPrefix} Model configuration complete:`, {
    modelId,
    enableWebBrowsing,
    toolsAvailable: !!tools,
    toolChoice,
    toolNames: tools ? Object.keys(tools) : [],
    timestamp: new Date().toISOString(),
  });

  return {
    model,
    modelConfig,
    tools,
    toolChoice,
  };
}
