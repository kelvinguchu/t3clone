import type { ModelConfig } from "@/lib/ai-providers";

export interface StreamHeaders {
  "Content-Type": string;
  "Cache-Control": string;
  Connection: string;
  "Transfer-Encoding": string;
  "X-Accel-Buffering": string;
  "Content-Encoding": string;
  "X-RateLimit-Remaining"?: string;
  "X-RateLimit-Limit"?: string;
  [key: string]: string | undefined;
}

export interface StreamResponseConfig {
  responseType: "data" | "text";
  sendReasoning?: boolean;
  headers: StreamHeaders;
}

// Determine appropriate streaming response configuration based on provider capabilities
export function buildStreamResponseConfig(
  modelConfig: ModelConfig,
  userId: string | null,
  remainingMessages: number,
): StreamResponseConfig {
  // Use different streaming approach based on provider and reasoning support
  const supportsReasoning = modelConfig.capabilities.thinking;

  // Base headers for all streaming responses
  const baseHeaders: StreamHeaders = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Connection: "keep-alive",
    "Transfer-Encoding": "chunked",
    "X-Accel-Buffering": "no", // Disable proxy buffering
    "Content-Encoding": "none", // Prevent compression issues
  };

  // Add rate limiting headers for anonymous users
  if (!userId) {
    baseHeaders["X-RateLimit-Remaining"] = remainingMessages.toString();
    baseHeaders["X-RateLimit-Limit"] = "10";
  }

  // Always use data stream for consistency with frontend configuration
  // This ensures proper tool calls, usage info, and finish reasons
  return {
    responseType: "data",
    sendReasoning: supportsReasoning,
    headers: baseHeaders,
  };
}
