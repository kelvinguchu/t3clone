import { streamText, convertToCoreMessages, type CoreMessage } from "ai";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import {
  getModel,
  getModelConfig,
  validateProviderKeys,
  type ModelId,
} from "@/lib/ai-providers";
import { Id } from "@/convex/_generated/dataModel";
import {
  getOrCreateAnonymousSession,
  getAnonymousSession,
} from "@/lib/utils/session";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

// Retrieve Convex-compatible token (template "convex") for the current user
async function getConvexFetchOptions() {
  const clerk = await auth();
  if (!clerk.userId) return { userId: null, fetchOptions: undefined };
  const token = await clerk.getToken({ template: "convex" });
  return { userId: clerk.userId, fetchOptions: token ? { token } : undefined };
}

export async function POST(req: NextRequest) {
  console.log("🚀 Chat API: Request received");

  try {
    // Validate provider API keys
    console.log("🔑 Chat API: Validating provider keys");
    validateProviderKeys();
    console.log("✅ Chat API: Provider keys validated");

    const { userId, fetchOptions } = await getConvexFetchOptions();
    console.log(
      "👤 Chat API: User ID:",
      userId ? "authenticated" : "anonymous",
    );

    const body = await req.json();
    console.log("📦 Chat API: Request body:", JSON.stringify(body, null, 2));

    const {
      messages,
      modelId = "gemini-2.0-flash" as ModelId,
      threadId: threadIdBody,
      temperature = 0.7,
      maxTokens = 2000,
      systemPrompt,
    } = body;

    // Allow header override (client may send X-Thread-Id)
    const threadIdHeader =
      req.headers.get("x-thread-id") ?? req.headers.get("X-Thread-Id");
    const threadId = threadIdBody ?? threadIdHeader ?? null;

    console.log("🤖 Chat API: Model ID:", modelId);
    console.log("💬 Chat API: Messages count:", messages?.length ?? 0);
    console.log("🧵 Chat API: Thread ID:", threadId ?? "none");

    // Validate model
    console.log("🔍 Chat API: Getting model config for:", modelId);
    const modelConfig = getModelConfig(modelId);
    console.log(
      "⚙️ Chat API: Model config:",
      JSON.stringify(modelConfig, null, 2),
    );

    console.log("🎯 Chat API: Getting model instance");
    const model = getModel(modelId);
    console.log("✅ Chat API: Model instance created");

    // Validate that model was created successfully
    if (!model) {
      console.error("❌ Chat API: Model instance is null/undefined");
      throw new Error(`Failed to create model instance for ${modelId}`);
    }

    // ----------------------------------------------------
    // Extract anonymous session ID from headers/cookies so we can still
    // reference legacy anonymous threads *after* the user signs in.
    // This runs for BOTH authenticated and anonymous requests.
    // ----------------------------------------------------
    let sessionId: string | null = null;
    let remainingMessages = 0;

    const headerSessionId =
      req.headers.get("x-session-id") ?? req.headers.get("X-Session-ID");

    const cookieSessionId = (await cookies()).get("anon_session_id")?.value;

    sessionId = headerSessionId ?? cookieSessionId ?? null;

    // Handle anonymous users -------------------------------------------------
    if (!userId) {
      console.log("🔒 Chat API: Handling anonymous user");

      // Validate session if provided
      if (sessionId) {
        const existing = await getAnonymousSession(sessionId);
        if (!existing) {
          console.warn(
            "⚠️ Chat API: Provided session not found/expired – falling back",
          );
          sessionId = null;
        }
      }

      // If no valid client session, create / reuse based on IP + UA
      if (!sessionId) {
        const preferredId = cookieSessionId ?? undefined;

        if (preferredId) {
          const existing = await getAnonymousSession(preferredId);
          if (existing) {
            sessionId = existing.sessionId;
            console.log("🆔 Chat API: Using cookie session", sessionId);
          }
        }

        if (!sessionId) {
          const userAgent = req.headers.get("user-agent") ?? "";
          const ip =
            req.headers.get("x-forwarded-for") ??
            req.headers.get("x-real-ip") ??
            "unknown";
          const ipHash = btoa(ip).slice(0, 16); // Simple hash for privacy

          const sessionData = await getOrCreateAnonymousSession(
            userAgent,
            ipHash,
          );
          sessionId = sessionData.sessionId;

          console.log("🆔 Chat API: Anonymous session (new/existing):", {
            sessionId: sessionData.sessionId,
            messageCount: sessionData.messageCount,
            remainingMessages: sessionData.remainingMessages,
          });
        }
      }

      // ---------------------------------------------
      // Rate-limit check using Convex session stats
      // This keeps server-side logic in sync with the
      // stats used by the client UI.
      // ---------------------------------------------
      try {
        // Dynamically import fetchQuery to avoid circular deps
        const { fetchQuery } = await import("convex/nextjs");

        const sessionStats = await fetchQuery(
          api.sessionStats.getAnonymousSessionStats,
          { sessionId: sessionId! },
        );

        console.log("📈 Chat API: Convex session stats", sessionStats);

        if (sessionStats.remainingMessages <= 0) {
          console.log("🚫 Chat API: Rate limit exceeded for anonymous user");
          return new Response(
            JSON.stringify({
              error: "Message limit exceeded. Please sign up to continue.",
              code: "RATE_LIMITED",
            }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        // Reserve one message slot for this request so that extremely fast
        // consecutive requests can't race the limit. We don't need to make an
        // extra write because the user message will be persisted in Convex
        // right after this check.
        remainingMessages = Math.max(0, sessionStats.remainingMessages - 1);
        console.log(
          "✅ Chat API: Rate limit OK, remaining messages:",
          remainingMessages,
        );
      } catch (statsError) {
        console.error("❌ Chat API: Failed to fetch session stats", statsError);
        // In case of failure, fall back to previous KV-based logic to avoid
        // blocking the user unnecessarily.
        const fallbackSession = await getAnonymousSession(sessionId!);
        if (!fallbackSession || fallbackSession.remainingMessages <= 0) {
          return new Response(
            JSON.stringify({
              error: "Message limit exceeded. Please sign up to continue.",
              code: "RATE_LIMITED",
            }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }
        remainingMessages = Math.max(0, fallbackSession.remainingMessages - 1);
      }
    }

    let finalThreadId = threadId;

    // Create thread if it doesn't exist (for new conversations)
    if (!finalThreadId && messages.length > 0) {
      console.log("🧵 Chat API: Creating new thread");
      const lastMessage = messages[messages.length - 1];

      // Smart title: strip markdown/code fences and limit length
      const raw = lastMessage.content
        .replace(/```[\s\S]*?```/g, "") // remove code fences
        .replace(/`([^`]*)`/g, "$1") // inline code
        .replace(/\n+/g, " ")
        .trim();

      const smartTitle = raw.split(" ").slice(0, 12).join(" ");

      console.log("📝 Chat API: Thread title will be:", smartTitle);

      if (userId) {
        console.log("👤 Chat API: Creating authenticated thread");
        // Authenticated user - create thread in Convex
        finalThreadId = await fetchMutation(
          api.threads.createThread,
          {
            title: smartTitle || "New Chat",
            model: modelId,
            systemPrompt,
          },
          fetchOptions,
        );
        console.log(
          "✅ Chat API: Authenticated thread created:",
          finalThreadId,
        );
      } else {
        console.log(
          "🔒 Chat API: Creating anonymous thread for session:",
          sessionId,
        );
        // Anonymous user - create anonymous thread
        finalThreadId = await fetchMutation(api.threads.createAnonymousThread, {
          sessionId: sessionId!,
          title: smartTitle || "New Chat",
          model: modelId,
          systemPrompt,
        });
        console.log("✅ Chat API: Anonymous thread created:", finalThreadId);
      }
    } else if (finalThreadId) {
      console.log("🧵 Chat API: Using existing thread:", finalThreadId);
    }

    // Add user message to database if we have a thread
    if (finalThreadId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === "user") {
        if (userId) {
          await fetchMutation(
            api.messages.addMessage,
            {
              threadId: finalThreadId as Id<"threads">,
              content: lastMessage.content,
              role: "user",
            },
            fetchOptions,
          );
        } else {
          await fetchMutation(api.messages.createAnonymousMessage, {
            threadId: finalThreadId as Id<"threads">,
            sessionId: sessionId!,
            content: lastMessage.content,
            role: "user",
            ...(sessionId ? { sessionId } : {}),
          });
        }
      }
    }

    // Note: Message count is already incremented above for anonymous users

    // Convert messages to core format and add system prompt
    console.log("🔄 Chat API: Converting messages to core format");
    const coreMessages = convertToCoreMessages(messages);
    console.log(
      "📨 Chat API: Core messages:",
      JSON.stringify(coreMessages, null, 2),
    );

    const finalMessages: CoreMessage[] = [];

    if (systemPrompt) {
      console.log("💭 Chat API: Adding system prompt");
      finalMessages.push({ role: "system", content: systemPrompt });
    }
    finalMessages.push(...coreMessages);
    console.log("📋 Chat API: Final messages count:", finalMessages.length);

    // Stream the AI response
    console.log("🚀 Chat API: Starting AI stream with config:");
    console.log("  - Temperature:", temperature);
    console.log("  - Max tokens:", Math.min(maxTokens, modelConfig.maxTokens));
    console.log("  - Model:", modelId);

    console.log("🎬 Chat API: Calling streamText...");
    const result = streamText({
      model,
      messages: finalMessages,
      temperature,
      maxTokens: Math.min(maxTokens, modelConfig.maxTokens),
      onFinish: async ({ text, usage, finishReason }) => {
        console.log("🏁 Chat API: Stream finished");
        console.log("📝 Chat API: Generated text length:", text?.length || 0);
        console.log(
          "📝 Chat API: Generated text content:",
          JSON.stringify(
            text?.slice(0, 100) + (text && text.length > 100 ? "..." : ""),
          ),
        );
        console.log("📊 Chat API: Usage:", JSON.stringify(usage, null, 2));
        console.log("🔚 Chat API: Finish reason:", finishReason);

        // Save assistant response to database
        if (finalThreadId) {
          console.log(
            "💾 Chat API: Saving assistant response to thread:",
            finalThreadId,
          );
          try {
            if (userId) {
              await fetchMutation(
                api.messages.addMessage,
                {
                  threadId: finalThreadId as Id<"threads">,
                  content: text,
                  role: "assistant",
                  model: modelId,
                  tokenCount: usage?.totalTokens,
                  finishReason,
                },
                fetchOptions,
              );
            } else {
              await fetchMutation(api.messages.createAnonymousMessage, {
                threadId: finalThreadId as Id<"threads">,
                sessionId: sessionId!,
                content: text,
                role: "assistant",
                model: modelId,
                ...(sessionId ? { sessionId } : {}),
              });
            }
            console.log("✅ Chat API: Assistant message saved successfully");
          } catch (error) {
            console.error(
              "❌ Chat API: Error saving assistant message:",
              error,
            );
            console.error(
              "❌ Chat API: Error details:",
              error instanceof Error ? error.stack : String(error),
            );
          }
        } else {
          console.log("⚠️ Chat API: No thread ID, skipping message save");
        }

        // Track usage for authenticated users
        if (userId && usage) {
          try {
            const inputTokens = usage.promptTokens || 0;
            const outputTokens = usage.completionTokens || 0;
            const inputCost =
              (inputTokens / 1000) * modelConfig.costPer1kTokens.input;
            const outputCost =
              (outputTokens / 1000) * modelConfig.costPer1kTokens.output;
            const totalCostCents = Math.round((inputCost + outputCost) * 100);

            await fetchMutation(
              api.users.updateUsage,
              {
                userId,
                provider: modelConfig.provider,
                tokens: inputTokens + outputTokens,
                costInCents: totalCostCents,
              },
              fetchOptions,
            );
            console.log("✅ Chat API: Usage tracking updated successfully");
          } catch (error) {
            console.error("❌ Chat API: Error tracking usage:", error);
          }
        }
      },
      onError: ({ error }) => {
        console.error("❌ Chat API: Stream error occurred:", error);
        console.error(
          "❌ Chat API: Stream error name:",
          error instanceof Error ? error.name : "Unknown",
        );
        console.error(
          "❌ Chat API: Stream error message:",
          error instanceof Error ? error.message : String(error),
        );
        console.error(
          "❌ Chat API: Stream error stack:",
          error instanceof Error ? error.stack : "No stack",
        );
      },
    });
    console.log("✅ Chat API: streamText call completed");

    // Add custom headers for rate limiting info
    const headers = new Headers();
    if (!userId) {
      headers.set("X-RateLimit-Remaining", remainingMessages.toString());
      headers.set("X-RateLimit-Limit", "10");
      headers.set("X-Thread-Id", finalThreadId ?? "");
    }
    if (finalThreadId) {
      headers.set("X-Thread-Id", finalThreadId);
    }

    console.log("📤 Chat API: Converting to data stream response");
    try {
      const response = result.toDataStreamResponse({ headers });
      console.log("✅ Chat API: Response created successfully");
      return response;
    } catch (streamError) {
      console.error(
        "💥 Chat API: Error creating stream response:",
        streamError,
      );
      throw streamError;
    }
  } catch (error) {
    console.error("💥 Chat API: Critical error occurred:", error);
    console.error(
      "💥 Chat API: Error name:",
      error instanceof Error ? error.name : "Unknown",
    );
    console.error(
      "💥 Chat API: Error message:",
      error instanceof Error ? error.message : "Unknown",
    );
    console.error(
      "💥 Chat API: Error stack:",
      error instanceof Error ? error.stack : "No stack",
    );

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("Missing required environment variables")) {
        return new Response(
          JSON.stringify({
            error: "AI service configuration error",
            type: "CONFIG_ERROR",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      if (
        error.message.includes("Model") &&
        error.message.includes("not found")
      ) {
        return new Response(
          JSON.stringify({
            error: "Invalid model selected",
            type: "INVALID_MODEL",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({
        error: "Failed to generate response. Please try again.",
        type: "UNKNOWN_ERROR",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
