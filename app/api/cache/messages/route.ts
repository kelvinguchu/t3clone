import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { conversationCache, type ConversationMessage } from "@/lib/kv";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const body = await request.json();

    const { threadId, message, sessionId } = body;

    if (!threadId || !message) {
      return Response.json(
        { error: "threadId and message are required" },
        { status: 400 },
      );
    }

    // Create conversation message
    const conversationMessage: ConversationMessage = {
      role: message.role,
      content: message.content,
      timestamp: message.timestamp || Date.now(),
      model: message.model,
      messageId: message.messageId || `${message.role}-${Date.now()}`,
    };

    // Cache the message
    await conversationCache.appendMessage(threadId, conversationMessage);

    // Update metadata if provided
    if (message.model || userId || sessionId) {
      await conversationCache.updateMetadata(threadId, {
        model: message.model,
        userId: userId || undefined,
        sessionId: sessionId || undefined,
      });
    }

    return Response.json({
      success: true,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to cache message:", error);
    return Response.json({ error: "Failed to cache message" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return Response.json({ error: "threadId is required" }, { status: 400 });
    }

    const summary = await conversationCache.getContextSummary(threadId);

    return Response.json({
      data: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to get cache summary:", error);
    return Response.json(
      { error: "Failed to get cache summary" },
      { status: 500 },
    );
  }
}
