import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  conversationCache,
  type ConversationMessage,
  kvPipeline,
} from "@/lib/kv";

// Optimize for performance - this route handles dynamic data
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Use Node.js runtime for Redis operations

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parallel auth and body parsing for better performance
    const [authResult, body] = await Promise.all([
      auth(),
      request.json().catch(() => null),
    ]);

    const { userId } = authResult;

    if (!body) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store", // Don't cache error responses
          },
        },
      );
    }

    const { threadId, message, sessionId } = body;

    if (!threadId || !message) {
      return new Response(
        JSON.stringify({ error: "threadId and message are required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // Create conversation message
    const conversationMessage: ConversationMessage = {
      role: message.role,
      content: message.content,
      timestamp: message.timestamp ?? Date.now(),
      model: message.model,
      messageId: message.messageId ?? `${message.role}-${Date.now()}`,
    };

    // Use pipelining for better performance when both operations are needed
    const operations: Array<() => Promise<unknown>> = [
      () => conversationCache.appendMessage(threadId, conversationMessage),
    ];

    // Add metadata update operation if needed
    if (message.model || userId || sessionId) {
      operations.push(() =>
        conversationCache.updateMetadata(threadId, {
          model: message.model,
          userId: userId ?? undefined,
          sessionId: sessionId ?? undefined,
        }),
      );
    }

    // Execute operations in parallel for better performance
    await kvPipeline.executePipeline(operations);

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        cached: true,
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // Cache successful POST responses briefly to reduce duplicate requests
          "Cache-Control": "private, max-age=5",
          "X-Processing-Time": `${processingTime}ms`,
        },
      },
    );
  } catch (error) {
    console.error("Failed to cache message:", error);

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        error: "Failed to cache message",
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Processing-Time": `${processingTime}ms`,
        },
      },
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return new Response(JSON.stringify({ error: "threadId is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    const summary = await conversationCache.getContextSummary(threadId);
    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        data: summary,
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // Cache GET responses for conversation summaries
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
          "X-Processing-Time": `${processingTime}ms`,
          // Add ETag for better caching
          ETag: `"${threadId}-${summary?.lastUpdated || Date.now()}"`,
        },
      },
    );
  } catch (error) {
    console.error("Failed to get cache summary:", error);

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        error: "Failed to get cache summary",
        timestamp: new Date().toISOString(),
        processingTime: `${processingTime}ms`,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Processing-Time": `${processingTime}ms`,
        },
      },
    );
  }
}
