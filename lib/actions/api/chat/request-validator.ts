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

// Validate incoming chat request data
export function validateChatRequest(
  body: ChatRequestBody,
  threadIdHeader?: string | null,
  requestId?: string,
): { validation: ValidationResult; data?: ValidatedRequestData } {
  const logPrefix = requestId ? `[${requestId}]` : "[validateChatRequest]";

  // Validate messages array
  if (
    !body.messages ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    console.error(`${logPrefix} CHAT_API - Invalid messages:`, {
      messages: body.messages,
      isArray: Array.isArray(body.messages),
      length: body.messages?.length,
    });

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

  // Extract and validate other fields
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

  // Set higher default maxTokens for reasoning models
  const defaultMaxTokens =
    modelId === "deepseek-r1-distill-llama-70b" || modelId === "qwen/qwen3-32b"
      ? 8192
      : 2000;
  const maxTokens = requestMaxTokens ?? defaultMaxTokens;

  // Resolve thread ID (body takes precedence over header)
  const finalThreadId = threadIdBody ?? threadIdHeader ?? null;

  // Get enableWebBrowsing from either direct property or options object
  const enableWebBrowsing =
    directEnableWebBrowsing ?? options?.enableWebBrowsing ?? false;

  // Log request details for debugging retry operations
  console.log(`${logPrefix} CHAT_API - Request validation:`, {
    messagesCount: messages.length,
    modelId,
    threadId: finalThreadId,
    hasThreadId: !!finalThreadId,
    lastMessageRole: messages[messages.length - 1]?.role,
    enableWebBrowsing,
  });

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
