import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getSmartContext,
  getConversationSummary,
  getRecentContext,
} from "@/lib/conversation-context";
import { rateLimiter } from "@/lib/kv";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);

    const threadId = searchParams.get("threadId");
    const model = searchParams.get("model") || "gemini-2.0-flash";
    const operation = searchParams.get("operation") || "context"; // context, summary, recent
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!threadId) {
      return Response.json({ error: "threadId is required" }, { status: 400 });
    }

    // Rate limiting for API access
    const rateLimitKey =
      userId || `ip-${request.headers.get("x-forwarded-for") || "unknown"}`;
    if (!(await rateLimiter.checkLimit(rateLimitKey, 60, 30))) {
      // 30 requests per minute
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    let result;
    const startTime = Date.now();

    switch (operation) {
      case "context":
        result = await getSmartContext(threadId, model);
        break;

      case "summary":
        result = await getConversationSummary(threadId);
        break;

      case "recent":
        result = await getRecentContext(threadId, limit);
        break;

      default:
        return Response.json({ error: "Invalid operation" }, { status: 400 });
    }

    const duration = Date.now() - startTime;

    if (!result) {
      return Response.json(
        { error: "Conversation context not found" },
        { status: 404 },
      );
    }

    return Response.json({
      data: result,
      meta: {
        operation,
        threadId,
        model,
        duration: `${duration}ms`,
        cached: true,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to get conversation context:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { threadIds, model, operation = "context" } = body;

    if (!Array.isArray(threadIds) || threadIds.length === 0) {
      return Response.json(
        { error: "threadIds array is required" },
        { status: 400 },
      );
    }

    if (threadIds.length > 10) {
      return Response.json(
        { error: "Maximum 10 threads allowed per request" },
        { status: 400 },
      );
    }

    // Rate limiting for batch operations
    if (!(await rateLimiter.checkLimit(userId, 60, 10))) {
      // 10 batch requests per minute
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const startTime = Date.now();
    const results: Record<string, unknown> = {};

    // Process each thread
    await Promise.all(
      threadIds.map(async (threadId: string) => {
        try {
          switch (operation) {
            case "context":
              results[threadId] = await getSmartContext(
                threadId,
                model || "gemini-2.0-flash",
              );
              break;

            case "summary":
              results[threadId] = await getConversationSummary(threadId);
              break;

            default:
              results[threadId] = { error: "Invalid operation" };
          }
        } catch (error) {
          console.error(`Failed to get context for thread ${threadId}:`, error);
          results[threadId] = { error: "Failed to load context" };
        }
      }),
    );

    const duration = Date.now() - startTime;

    return Response.json({
      data: results,
      meta: {
        operation,
        threadCount: threadIds.length,
        model: model || "gemini-2.0-flash",
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to process batch context request:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Health check endpoint
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "x-cache-status": "operational",
      "x-service": "conversation-context",
    },
  });
}
 