import type { Message } from "ai";
import type { ModelId } from "@/lib/ai-providers";

export interface ValidationResult {
  isValid: boolean;
  error?: {
    message: string;
    code: string;
    status: number;
  };
}

export interface ValidatedRequestData {
  messages: Message[];
  modelId: ModelId;
  threadId: string | null;
  temperature: number;
  maxTokens: number;
  attachmentIds?: string[];
  enableWebBrowsing: boolean;
}

export interface ChatRequestBody {
  messages?: Message[];
  modelId?: ModelId;
  threadId?: string;
  temperature?: number;
  maxTokens?: number;
  attachmentIds?: string[];
  enableWebBrowsing?: boolean;
  options?: {
    enableWebBrowsing?: boolean;
  };
}

// Validate and extract chat request parameters
export function validateChatRequest(
  body: ChatRequestBody,
  threadIdHeader?: string | null,
): { validation: ValidationResult; data?: ValidatedRequestData } {
  // Validate required messages array
  if (
    !body.messages ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return {
      validation: {
        isValid: false,
        error: {
          message: "Invalid request: messages array is required",
          code: "INVALID_MESSAGES",
          status: 400,
        },
      },
    };
  }

  // Extract request parameters with defaults
  const {
    messages,
    modelId = "gemini-2.0-flash" as ModelId,
    threadId: threadIdBody,
    temperature = 0.7,
    maxTokens: requestMaxTokens,
    attachmentIds,
    enableWebBrowsing: directEnableWebBrowsing,
    options,
  } = body;

  // Set higher token limits for reasoning models
  const defaultMaxTokens =
    modelId === "deepseek-r1-distill-llama-70b" || modelId === "qwen/qwen3-32b"
      ? 8192
      : 2000;
  const maxTokens = requestMaxTokens ?? defaultMaxTokens;

  // Resolve thread ID (body takes precedence over header)
  const finalThreadId = threadIdBody ?? threadIdHeader ?? null;

  // Resolve web browsing setting from multiple sources
  const enableWebBrowsing =
    directEnableWebBrowsing ?? options?.enableWebBrowsing ?? false;

  return {
    validation: { isValid: true },
    data: {
      messages,
      modelId,
      threadId: finalThreadId,
      temperature,
      maxTokens,
      attachmentIds,
      enableWebBrowsing,
    },
  };
}
