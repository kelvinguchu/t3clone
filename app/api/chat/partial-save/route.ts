import { NextRequest } from "next/server";
import { getConvexFetchOptions } from "@/lib/actions/api/chat/auth-utils";
import { resolveSessionInfo } from "@/lib/actions/api/chat/session-manager";
import { createThreadIfNeeded } from "@/lib/actions/api/chat/thread-manager";
import { saveUserMessage } from "@/lib/actions/api/chat/message-saver";
import { processAIResponseMessages } from "@/lib/actions/api/chat/response-processor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = `partial-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { userId, fetchOptions } = await getConvexFetchOptions();
    const body = await req.json();

    const {
      messages,
      modelId,
      threadId,
      partialContent,
      attachmentIds = [],
    } = body;

    if (!partialContent || !partialContent.trim()) {
      return new Response(
        JSON.stringify({
          error: "No partial content to save",
          code: "NO_CONTENT",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    console.log(`[${requestId}] PARTIAL_SAVE - Saving partial response`, {
      threadId,
      contentLength: partialContent.length,
      modelId,
      userId: userId ? "authenticated" : "anonymous",
    });

    // Extract session info
    const { sessionId } = await resolveSessionInfo(req, userId);

    // Create thread if needed
    let finalThreadId = threadId;
    if (!finalThreadId) {
      const threadResult = await createThreadIfNeeded(
        null,
        messages,
        modelId,
        userId,
        sessionId,
        fetchOptions,
        requestId,
      );
      finalThreadId = threadResult.threadId;
    }

    if (!finalThreadId) {
      throw new Error("Failed to create or find thread for partial save");
    }

    // Save user message if this is a new conversation
    if (!threadId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "user") {
        await saveUserMessage(
          true, // shouldSaveUserMessage
          messages,
          finalThreadId,
          userId,
          sessionId,
          attachmentIds,
          fetchOptions,
          requestId,
        );
      }
    }

    // Create partial response message
    const partialResponseMessages = [
      {
        id: `partial-${Date.now()}`,
        role: "assistant" as const,
        content: partialContent,
        // Mark as partial for potential future continuation
        experimental_data: {
          isPartial: true,
          stoppedAt: new Date().toISOString(),
          stoppedByUser: true,
        },
      },
    ];

    // Save the partial AI response
    await processAIResponseMessages({
      responseMessages: partialResponseMessages,
      finalThreadId,
      userId,
      finalSessionId: sessionId,
      modelId,
      toolsUsedInResponse: [], // No tools in partial response
      hasAnyToolCalls: false,
      usage: {
        totalTokens: Math.ceil(partialContent.length / 4), // Rough estimate
      },
      finishReason: "stop", // User stopped the generation
      extractedReasoning: undefined,
      fetchOptions,
      requestId,
    });

    console.log(
      `[${requestId}] PARTIAL_SAVE - Successfully saved partial response`,
      {
        threadId: finalThreadId,
        contentLength: partialContent.length,
      },
    );

    return new Response(
      JSON.stringify({
        success: true,
        threadId: finalThreadId,
        message: "Partial response saved successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...(finalThreadId && { "X-Thread-Id": finalThreadId }),
        },
      },
    );
  } catch (error) {
    console.error(
      `[${requestId}] PARTIAL_SAVE - Failed to save partial response:`,
      error,
    );

    return new Response(
      JSON.stringify({
        error: "Failed to save partial response",
        message: error instanceof Error ? error.message : "Unknown error",
        retryable: true,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
