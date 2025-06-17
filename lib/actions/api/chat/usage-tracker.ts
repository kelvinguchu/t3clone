import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { ModelConfig } from "@/lib/ai-providers";

export interface UsageTrackingResult {
  success: boolean;
  costInCents?: number;
  totalTokens?: number;
  error?: string;
}

// Track usage for authenticated users
export async function trackUsage(
  userId: string | null,
  usage:
    | {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      }
    | undefined,
  modelConfig: ModelConfig,
  fetchOptions?: { token: string },
  requestId?: string,
): Promise<UsageTrackingResult> {
  const logPrefix = requestId ? `[${requestId}]` : "[trackUsage]";

  // Only track usage for authenticated users
  if (!userId) {
    return { success: true }; // Not an error, just skip tracking
  }

  if (!usage) {
    return { success: true }; // No usage data to track
  }

  try {
    const inputTokens = usage.promptTokens || 0;
    const outputTokens = usage.completionTokens || 0;
    const totalTokens = inputTokens + outputTokens;

    const inputCost = (inputTokens / 1000) * modelConfig.costPer1kTokens.input;
    const outputCost =
      (outputTokens / 1000) * modelConfig.costPer1kTokens.output;
    const totalCostCents = Math.round((inputCost + outputCost) * 100);

    await fetchMutation(
      api.users.updateUsage,
      {
        userId,
        provider: modelConfig.provider,
        tokens: totalTokens,
        costInCents: totalCostCents,
      },
      fetchOptions,
    );

    return {
      success: true,
      costInCents: totalCostCents,
      totalTokens,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `${logPrefix} CHAT_API - Background usage tracking failed:`,
      error,
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}
