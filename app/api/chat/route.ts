import { streamText, type CoreMessage } from "ai";
import { NextRequest } from "next/server";

import { getOrCreateAnonymousSession } from "@/lib/utils/session";
import { processMultimodalMessages } from "@/lib/actions/api/chat/multimodal-processor";
import { getConvexFetchOptions } from "@/lib/actions/api/chat/auth-utils";
import { resolveSessionInfo } from "@/lib/actions/api/chat/session-manager";
import { checkAnonymousRateLimit } from "@/lib/actions/api/chat/rate-limiter";
import { validateChatRequest } from "@/lib/actions/api/chat/request-validator";
import { setupModelConfiguration } from "@/lib/actions/api/chat/model-manager";
import { createThreadIfNeeded } from "@/lib/actions/api/chat/thread-manager";
import { detectRetryOperation } from "@/lib/actions/api/chat/retry-detector";
import { saveUserMessage } from "@/lib/actions/api/chat/message-saver";
import { detectToolUsage } from "@/lib/actions/api/chat/tool-detector";
import { processAIResponseMessages } from "@/lib/actions/api/chat/response-processor";
import { trackUsage } from "@/lib/actions/api/chat/usage-tracker";
import {
  cacheConversationContext,
  cleanupBrowserSessions,
} from "@/lib/actions/api/chat/conversation-cacher";
import { resumeStream } from "@/lib/actions/api/chat/stream-resumer";
import { buildStreamResponseConfig } from "@/lib/actions/api/chat/stream-response-builder";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// GET handler for resuming streams
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new Response("chatId is required", { status: 400 });
  }

  const result = await resumeStream(chatId);
  return result.response;
}

export async function POST(req: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { userId, fetchOptions } = await getConvexFetchOptions();
    const body = await req.json();

    // Validate request and extract parameters
    const threadIdHeader =
      req.headers.get("x-thread-id") ?? req.headers.get("X-Thread-Id");
    const { validation, data } = validateChatRequest(
      body,
      threadIdHeader,
      requestId,
    );

    if (!validation.isValid) {
      return new Response(
        JSON.stringify({
          error: validation.error!.message,
          code: validation.error!.code,
        }),
        {
          status: validation.error!.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const {
      messages,
      modelId,
      threadId,
      temperature = 0.5,
      maxTokens = 4096,
      attachmentIds = [],
      enableWebBrowsing = false,
    } = data!;

    // Request parameters extracted and validated

    // Smart message handling: detect retries vs new messages
    // Retries use database history, new messages use client data
    let messagesForAI: CoreMessage[] = [];
    let isRetryFromConvex = false;
    const originalMessages = messages; // Keep original messages for functions that need Message[]

    // Only check for Convex history if this might be a retry AND we have an existing thread
    if (threadId && messages.length > 1) {
      try {
        // Load the actual conversation history from Convex
        const existingMessages = await fetchQuery(
          api.messages.getThreadMessages,
          { threadId: threadId as Id<"threads"> },
          fetchOptions,
        );

        if (existingMessages && existingMessages.length > 0) {
          // Check if this is actually a retry by comparing the last user message
          const lastUserMessageFromClient = messages
            .filter((msg) => msg.role === "user")
            .pop();

          const lastUserMessageFromDB = existingMessages
            .filter((msg) => msg.role === "user")
            .pop();

          // Only use Convex history if the last user messages match exactly (indicating a retry)
          const isActualRetry =
            lastUserMessageFromClient &&
            lastUserMessageFromDB &&
            lastUserMessageFromClient.content === lastUserMessageFromDB.content;

          if (isActualRetry) {
            // Retry detected: use conversation history from database
            messagesForAI = existingMessages.map((msg) => ({
              role: msg.role as "user" | "assistant" | "system",
              content: msg.content,
            }));

            isRetryFromConvex = true;
          } else {
            // New message: use client-provided messages
          }
        } else if (existingMessages === null) {
          // Thread was deleted: fall back to client messages
        }
      } catch {
        // Convex query failed: fall back to client messages
      }
    }

    // Extract session info quickly
    const { sessionId, remainingMessages: defaultRemainingMessages } =
      await resolveSessionInfo(req, userId);
    let remainingMessages = defaultRemainingMessages;

    // QUICK rate limit check for anonymous users (non-blocking)
    const rateLimitResult = await checkAnonymousRateLimit(userId, sessionId);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: rateLimitResult.errorMessage ?? "Rate limit exceeded",
          code: "RATE_LIMITED",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }
    remainingMessages = rateLimitResult.remainingMessages;

    // Setup model configuration early to get capabilities for multimodal processing
    const { model, modelConfig, tools, toolChoice } =
      await setupModelConfiguration(
        modelId,
        enableWebBrowsing,
        userId ?? undefined,
        fetchOptions,
        requestId,
      );

    // Process multimodal messages for all new messages (not retries)
    // This handles blob URL filtering and proper CoreMessage conversion
    if (!isRetryFromConvex) {
      const processedCoreMessages = await processMultimodalMessages(
        originalMessages,
        attachmentIds,
        fetchOptions,
        {
          vision: modelConfig.capabilities.vision,
          multimodal: modelConfig.capabilities.multimodal,
          fileAttachments: modelConfig.capabilities.fileAttachments,
        },
      );

      // Use the processed core messages directly - they're already in CoreMessage format
      // The multimodal processor has already converted and filtered messages properly
      messagesForAI = processedCoreMessages;
    }

    // Early thread creation (needed for X-Thread-Id header)
    let earlyThreadId: string | null = threadId ?? null;

    if (!earlyThreadId) {
      try {
        const threadRes = await createThreadIfNeeded(
          null,
          messages,
          modelId,
          userId,
          sessionId,
          fetchOptions,
          requestId,
        );
        if (threadRes.success && threadRes.threadId) {
          earlyThreadId = threadRes.threadId;
        }
      } catch {
        // Thread creation failed: continue without early ID
      }
    }

    // Model configuration was already set up earlier for multimodal processing

    // Get dynamic system prompt for the user (if customization preferences are set)
    const { getDynamicSystemPrompt } = await import("@/lib/ai-providers");
    const dynamicSystemPrompt = await getDynamicSystemPrompt(
      userId ?? undefined,
    );

    // If we received a dynamic system prompt, prepend it as a system message
    if (dynamicSystemPrompt) {
      // Avoid duplicating system messages if one already exists at the front
      if (
        messagesForAI.length === 0 ||
        messagesForAI[0].role !== "system" ||
        messagesForAI[0].content !== dynamicSystemPrompt
      ) {
        messagesForAI = [
          { role: "system", content: dynamicSystemPrompt },
          ...messagesForAI,
        ];
      }
    }

    // Start AI streaming immediately for optimal performance
    // Database operations happen in background via onFinish callback

    const result = streamText({
      model,
      messages: messagesForAI,
      ...(dynamicSystemPrompt && { system: dynamicSystemPrompt }),
      temperature,
      maxTokens: Math.min(maxTokens, modelConfig.maxTokens),
      ...(tools && { tools }),
      ...(toolChoice && { toolChoice }),
      ...(tools && { maxSteps: 10 }),
      ...(tools && { experimental_toolCallStreaming: true }),
      // Add provider options for Groq reasoning models
      ...(modelConfig.provider === "groq" &&
        modelConfig.capabilities.thinking && {
          providerOptions: {
            groq: {
              reasoningFormat: "parsed" as const,
            },
          },
        }),
      // Forward abort signal from client to AI provider
      abortSignal: req.signal,

      // Handle each step completion for multi-step tool calls
      onStepFinish: async () => {
        // CRITICAL: Make this callback completely non-blocking to prevent stream interruption
        // Use setImmediate to defer all operations to the next tick
        // Non-blocking step completion handling (for monitoring)
        setImmediate(() => {
          // All database operations moved to onFinish callback
        });
      },

      onFinish: async (result) => {
        // Background processing after stream completes
        // Handle session management for anonymous users
        let finalThreadId = earlyThreadId ?? threadId;
        let finalSessionId = sessionId;

        if (!userId) {
          try {
            // Create/validate session in background
            if (!finalSessionId) {
              const userAgent = req.headers.get("user-agent") ?? "";
              const ip =
                req.headers.get("x-forwarded-for") ??
                req.headers.get("x-real-ip") ??
                "unknown";
              const ipHash = btoa(ip).slice(0, 16);

              const sessionData = await getOrCreateAnonymousSession(
                userAgent,
                ipHash,
              );
              finalSessionId = sessionData.sessionId;
            }
          } catch {
            // Session creation failed: continue without session
          }
        }

        // Create thread if needed
        const threadResult = await createThreadIfNeeded(
          finalThreadId,
          messages,
          modelId,
          userId,
          finalSessionId,
          fetchOptions,
          requestId,
        );
        finalThreadId = threadResult.threadId;

        // Save messages to database
        if (finalThreadId) {
          try {
            // For retry operations, we never save user messages (they already exist)
            // For new conversations, we check and save as needed
            let shouldSaveUserMessage = !isRetryFromConvex;

            if (!isRetryFromConvex) {
              // Check if this is a retry operation and whether to save user message
              const retryResult = await detectRetryOperation(
                messages,
                finalThreadId,
                fetchOptions,
              );
              shouldSaveUserMessage = retryResult.shouldSaveUserMessage;

              // Retry detection completed
            } else {
              // Retry operation: skip user message save
            }

            // Save user message only if it doesn't already exist
            await saveUserMessage(
              shouldSaveUserMessage,
              messages,
              finalThreadId,
              userId,
              finalSessionId,
              attachmentIds,
              fetchOptions,
              requestId,
            );

            // Extract reasoning from the result - this is the key fix!
            let extractedReasoning: string | undefined;

            // Extract reasoning from AI response if available
            if (result.reasoning) {
              extractedReasoning = result.reasoning;
            }

            // Check response messages for reasoning parts
            if (!extractedReasoning && result.response.messages) {
              for (const message of result.response.messages) {
                if (
                  message.role === "assistant" &&
                  Array.isArray(message.content)
                ) {
                  const reasoningParts = message.content
                    .filter((part) => part.type === "reasoning")
                    .map(
                      (part) =>
                        (part as { reasoning?: string; text?: string })
                          .reasoning ||
                        (part as { reasoning?: string; text?: string }).text ||
                        "",
                    );

                  if (reasoningParts.length > 0) {
                    extractedReasoning = reasoningParts.join("\n");
                    break;
                  }
                }
              }
            }

            // Detect tool usage from response messages
            const { toolsUsedInResponse, hasAnyToolCalls } = detectToolUsage(
              result.response.messages,
            );

            // Save AI response messages (response.messages already contains only NEW messages)
            await processAIResponseMessages({
              responseMessages: result.response.messages,
              finalThreadId,
              userId,
              finalSessionId,
              modelId,
              toolsUsedInResponse,
              hasAnyToolCalls,
              usage: result.usage,
              finishReason: result.finishReason,
              // Pass the extracted reasoning to the processor
              extractedReasoning,
              fetchOptions,
              requestId,
            });
          } catch {
            // Message saving failed: continue with other operations
          }
        }

        // Cache conversation context
        await cacheConversationContext(
          finalThreadId,
          originalMessages, // Use original Message[] format for caching
          modelId,
          requestId,
        );

        // Track usage for authenticated users
        await trackUsage(
          userId,
          result.usage,
          modelConfig,
          fetchOptions,
          requestId,
        );

        // Cleanup browser sessions
        await cleanupBrowserSessions(requestId);
      },

      onError: () => {
        // Error handling for AI stream failures
      },
    });

    // Build stream response configuration
    const streamConfig = buildStreamResponseConfig(
      modelConfig,
      userId,
      remainingMessages,
    );

    // Attach the thread id so the client can redirect immediately
    if (earlyThreadId) {
      (streamConfig.headers as Record<string, string>)["X-Thread-Id"] =
        earlyThreadId;
    }

    // Return appropriate response type based on configuration
    if (streamConfig.responseType === "text") {
      return result.toTextStreamResponse({
        headers: streamConfig.headers as Record<string, string>,
      });
    }

    return result.toDataStreamResponse({
      sendReasoning: streamConfig.sendReasoning,
      headers: streamConfig.headers as Record<string, string>,
    });
  } catch (error) {
    // Determine appropriate status code and error type
    let status = 500;
    let errorType = "internal_error";
    let userMessage = "An unexpected error occurred. Please try again.";

    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      // Token limit errors
      if (
        errorMessage.includes("request too large") ||
        (errorMessage.includes("token") && errorMessage.includes("limit"))
      ) {
        status = 413;
        errorType = "token_limit_exceeded";
        userMessage =
          "Your message is too long for the selected model. Please try a shorter message.";
      }
      // Rate limit errors
      else if (
        errorMessage.includes("rate limit") ||
        errorMessage.includes("too many requests")
      ) {
        status = 429;
        errorType = "rate_limit_exceeded";
        userMessage =
          "You're sending messages too quickly. Please wait a moment and try again.";
      }
      // Authentication errors
      else if (
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("authentication")
      ) {
        status = 401;
        errorType = "authentication_error";
        userMessage = "Authentication failed. Please try signing in again.";
      }
      // Model availability errors
      else if (
        errorMessage.includes("model") &&
        errorMessage.includes("not found")
      ) {
        status = 404;
        errorType = "model_unavailable";
        userMessage =
          "The selected AI model is currently unavailable. Please try a different model.";
      }
    }

    return new Response(
      JSON.stringify({
        error: errorType,
        message: userMessage,
        technical_message:
          error instanceof Error ? error.message : "Unknown error",
        retryable: status !== 401, // Don't retry auth errors
      }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
