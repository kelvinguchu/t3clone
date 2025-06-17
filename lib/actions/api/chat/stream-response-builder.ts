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
  requestId?: string,
): StreamResponseConfig {
  const logPrefix = requestId
    ? `[${requestId}]`
    : "[buildStreamResponseConfig]";

  // Use different streaming approach based on provider and reasoning support
  const supportsReasoning = modelConfig.capabilities.includes(
    "reasoning" as any,
  );

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

  // For Groq reasoning models, use data stream to send reasoning separately
  if (modelConfig.provider === "groq" && supportsReasoning) {
    return {
      responseType: "data",
      sendReasoning: true,
      headers: baseHeaders,
    };
  }

  // For non-reasoning Groq models, use text stream
  if (modelConfig.provider === "groq") {
    return {
      responseType: "text",
      headers: baseHeaders,
    };
  }

  // Use data stream for other providers (Gemini, OpenAI)
  return {
    responseType: "data",
    sendReasoning: supportsReasoning,
    headers: baseHeaders,
  };
}
