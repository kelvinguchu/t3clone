import { createDataStream } from "ai";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { createResumableStreamContext } from "resumable-stream";
import { after } from "next/server";

// Create resumable stream context for handling disconnections
const streamContext = createResumableStreamContext({
  waitUntil: after,
});

export interface StreamResumeResult {
  response: Response;
  success: boolean;
}

// Resume stream for a chat ID or return completed message
export async function resumeStream(
  chatId: string,
): Promise<StreamResumeResult> {
  try {
    // Load stream IDs for this chat
    const streamIds = await fetchQuery(api.streams.loadStreams, { chatId });

    if (!streamIds.length) {
      return {
        response: new Response("No streams found", { status: 404 }),
        success: false,
      };
    }

    const recentStreamId = streamIds[0]; // Most recent stream

    if (!recentStreamId) {
      return {
        response: new Response("No recent stream found", { status: 404 }),
        success: false,
      };
    }

    // Create empty data stream as fallback
    const emptyDataStream = createDataStream({
      execute: () => {},
    });

    // Try to resume the stream
    const stream = await streamContext.resumableStream(
      recentStreamId,
      () => emptyDataStream,
    );

    if (stream) {
      return {
        response: new Response(stream, { status: 200 }),
        success: true,
      };
    }

    // If stream is completed, return the most recent message
    const messages = await fetchQuery(api.streams.getMessagesByChatId, {
      id: chatId,
    });
    const mostRecentMessage = messages[messages.length - 1];

    if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
      return {
        response: new Response(emptyDataStream, { status: 200 }),
        success: true,
      };
    }

    // Create a stream with the completed message
    const streamWithMessage = createDataStream({
      execute: (buffer) => {
        buffer.writeData({
          type: "append-message",
          message: JSON.stringify(mostRecentMessage),
        });
      },
    });

    return {
      response: new Response(streamWithMessage, { status: 200 }),
      success: true,
    };
  } catch (error) {
    console.error("Error resuming stream:", error);
    return {
      response: new Response("Internal server error", { status: 500 }),
      success: false,
    };
  }
}
