import { streamText } from "ai";
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

// Performance optimizations for streaming chat API
export const dynamic = "force-dynamic"; // Always dynamic for real-time chat
export const runtime = "nodejs"; // Use Node.js runtime for AI SDK and Redis operations
export const maxDuration = 60; // Allow streaming responses up to 60 seconds

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
      temperature,
      maxTokens,
      attachmentIds,
      enableWebBrowsing,
    } = data!;

    // ----------------------------------------------------
    // OPTIMIZATION: Detect retry operations and load conversation from Convex
    // instead of accepting full conversation history from client
    // ----------------------------------------------------
    let messagesForAI = messages;
    let isRetryOperation = false;
    
    // Check if this is a retry operation (thread exists + multiple messages sent)
    if (threadId && messages.length > 1) {
      console.log(
        `[${requestId}] CHAT_API - Potential retry detected, loading conversation from Convex`,
        {
          threadId,
          clientMessagesCount: messages.length,
        }
      );

      try {
        // Load the actual conversation history from Convex
        const existingMessages = await fetchQuery(
          api.messages.getThreadMessages,
          { threadId: threadId as Id<"threads"> },
          fetchOptions,
        );

        // Convert Convex messages to AI SDK format
        const convexMessagesForAI = existingMessages.map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
          // Include tool information if available
          ...(msg.toolsUsed && msg.toolsUsed.length > 0 && {
            toolInvocations: msg.toolsUsed.map((tool) => ({
              toolCallId: `tool-${msg._id}-${tool}`,
              toolName: tool,
              state: "result" as const,
              args: {},
              result: "Tool execution completed",
            })),
          }),
        }));

        // Check if we have existing conversation
        if (convexMessagesForAI.length > 0) {
          console.log(
            `[${requestId}] CHAT_API - Using Convex conversation history`,
            {
              convexMessagesCount: convexMessagesForAI.length,
              lastMessageRole: convexMessagesForAI[convexMessagesForAI.length - 1]?.role,
            }
          );

          // Use Convex messages as the source of truth
          messagesForAI = convexMessagesForAI;
          isRetryOperation = true;

          // For retry operations, we don't need to add a new user message
          // The conversation history already contains what we need
        }
      } catch (error) {
        console.warn(
          `[${requestId}] CHAT_API - Failed to load conversation from Convex, using client messages`,
          error
        );
        // Fall back to using client messages if Convex load fails
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

    // Process multimodal messages if needed (only for new messages, not retries)
    if (!isRetryOperation) {
      messagesForAI = await processMultimodalMessages(
        messagesForAI,
        attachmentIds,
        fetchOptions,
      );
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
      } catch (err) {
        console.error(
          `[${requestId}] CHAT_API - Early thread creation failed`,
          err,
        );
      }
    }

    // Setup model configuration
    const { model, modelConfig, tools, toolChoice } = setupModelConfiguration(
      modelId,
      enableWebBrowsing,
      requestId,
    );

    // ------------------------------------------------------------------
    // IMMEDIATE STREAMING: Start AI response immediately
    // All database operations moved to onFinish for background processing
    // ------------------------------------------------------------------

    const result = streamText({
      model,
      messages: messagesForAI,
      temperature,
      maxTokens: Math.min(maxTokens, modelConfig.maxTokens),
      ...(tools && { tools }),
      ...(toolChoice && { toolChoice }),
      ...(tools && { maxSteps: 5 }),
      ...(tools && { experimental_toolCallStreaming: true }),
      // Add provider options for Groq reasoning models
      ...(modelConfig.provider === "groq" &&
        (modelConfig.capabilities as readonly string[]).includes(
          "reasoning",
        ) && {
          providerOptions: {
            groq: {
              reasoningFormat: "parsed" as const,
            },
          },
        }),

      onFinish: async (result) => {
        // Background: Handle session management for anonymous users
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
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Background session creation failed:`,
              error,
            );
          }
        }

        // Background: Create thread if needed
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

        // Background: Save messages to database
        if (finalThreadId) {
          try {
            // For retry operations, we never save user messages (they already exist)
            // For new conversations, we check and save as needed
            let shouldSaveUserMessage = !isRetryOperation;

            if (!isRetryOperation) {
              // Check if this is a retry operation and whether to save user message
              const retryResult = await detectRetryOperation(
                messages,
                finalThreadId,
                fetchOptions,
                requestId,
              );
              shouldSaveUserMessage = retryResult.shouldSaveUserMessage;

              // Debug logging for retry detection
              console.log(
                `[${requestId}] CHAT_API - Retry detection result:`,
                {
                  isRetryOperation: retryResult.isRetryOperation,
                  shouldSaveUserMessage,
                  messagesCount: messages.length,
                  lastMessageRole: messages[messages.length - 1]?.role,
                  threadId: finalThreadId,
                }
              );
            } else {
              console.log(
                `[${requestId}] CHAT_API - Retry operation detected via Convex history, skipping user message save`
              );
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

            // Method 1: Check if result has direct reasoning property (for some models)
            if (result.reasoning) {
              extractedReasoning = result.reasoning;
              console.log(
                `[${requestId}] CHAT_API - Direct reasoning extracted:`,
                extractedReasoning.substring(0, 100) + "...",
              );
            }

            // Method 2: Check response messages for reasoning parts
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
                    console.log(
                      `[${requestId}] CHAT_API - Message reasoning extracted:`,
                      extractedReasoning.substring(0, 100) + "...",
                    );
                    break;
                  }
                }
              }
            }

            // Detect tool usage from response messages
            const { toolsUsedInResponse, hasAnyToolCalls } = detectToolUsage(
              result.response.messages,
              requestId,
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
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Background message saving failed:`,
              error,
            );
          }
        }

        // Background: Cache conversation context
        await cacheConversationContext(
          finalThreadId,
          messagesForAI, // Use the actual messages sent to AI (from Convex)
          modelId,
          requestId,
        );

        // Background: Track usage for authenticated users
        await trackUsage(
          userId,
          result.usage,
          modelConfig,
          fetchOptions,
          requestId,
        );

        // Background: Cleanup browser sessions
        await cleanupBrowserSessions(requestId);
      },

      onError: (error) => {
        console.error(`[${requestId}] CHAT_API - streamText onError:`, error);

        // Log specific error types for better debugging
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("Request too large")) {
          console.error(
            `[${requestId}] CHAT_API - Token limit exceeded for model ${modelId}`,
          );
        } else if (errorMessage.includes("rate limit")) {
          console.error(
            `[${requestId}] CHAT_API - Rate limit exceeded for model ${modelId}`,
          );
        }
      },
    });

    // Build stream response configuration
    const streamConfig = buildStreamResponseConfig(
      modelConfig,
      userId,
      remainingMessages,
      requestId,
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
    console.error(`[${requestId}] CHAT_API - Request failed:`, error);

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
