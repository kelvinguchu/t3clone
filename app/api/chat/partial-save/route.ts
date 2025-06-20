import { NextRequest } from "next/server";
import { getConvexFetchOptions } from "@/lib/actions/api/chat/auth-utils";
import { resolveSessionInfo } from "@/lib/actions/api/chat/session-manager";
import { createThreadIfNeeded } from "@/lib/actions/api/chat/thread-manager";
import { saveUserMessage } from "@/lib/actions/api/chat/message-saver";
import { processAIResponseMessages } from "@/lib/actions/api/chat/response-processor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Saves partial AI responses when user stops generation mid-stream
export async function POST(req: NextRequest) {
  const requestId = `partial-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Extract request data and validate partial content
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

    // Validate and prepare partial content for saving

    // Resolve session and thread for partial save
    const { sessionId } = await resolveSessionInfo(req, userId);
    let finalThreadId = threadId;
    if (!finalThreadId) {
      const threadResult = await createThreadIfNeeded(
        null,
        messages,
        modelId,
        userId,
        sessionId,
        null,
        fetchOptions,
        requestId,
      );
      finalThreadId = threadResult.threadId;
    }

    if (!finalThreadId) {
      throw new Error("Failed to create or find thread for partial save");
    }

    // Save user message for new conversations
    if (!threadId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "user") {
        await saveUserMessage(
          true,
          messages,
          finalThreadId,
          userId,
          sessionId,
          attachmentIds,
          fetchOptions,
        );
      }
    }

    // Create partial response message with metadata
    const partialResponseMessages = [
      {
        id: `partial-${Date.now()}`,
        role: "assistant" as const,
        content: partialContent,
        experimental_data: {
          isPartial: true,
          stoppedAt: new Date().toISOString(),
          stoppedByUser: true,
        },
      },
    ];

    // Save partial response to database
    await processAIResponseMessages({
      responseMessages: partialResponseMessages,
      finalThreadId,
      userId,
      finalSessionId: sessionId,
      modelId,
      toolsUsedInResponse: [],
      hasAnyToolCalls: false,
      usage: {
        totalTokens: Math.ceil(partialContent.length / 4),
      },
      finishReason: "stop",
      extractedReasoning: undefined,
      fetchOptions,
      requestId,
    });

    // Partial save completed successfully

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
    // Handle partial save failures
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
