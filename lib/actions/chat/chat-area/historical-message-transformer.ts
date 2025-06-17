import type { Message } from "@ai-sdk/react";

// Type for historical message from Convex
export interface HistoricalMessage {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Array<{
    name: string;
    contentType: string;
    url: string;
  }>;
}

export interface TransformHistoricalMessagesResult {
  transformedMessages: Message[] | null;
  shouldSetInitialMessages: boolean;
}

// Transform historical messages from Convex to AI SDK format
export function transformHistoricalMessages(
  historicalMessages: HistoricalMessage[] | undefined,
  initialMessages: Message[] | undefined,
): TransformHistoricalMessagesResult {
  if (!historicalMessages || initialMessages !== undefined) {
    return {
      transformedMessages: null,
      shouldSetInitialMessages: false,
    };
  }

  const transformedMessages = historicalMessages.map(
    (msg) =>
      ({
        id: msg._id,
        role: msg.role,
        content: msg.content,
        experimental_attachments: msg.attachments?.map((att) => ({
          name: att.name,
          contentType: att.contentType,
          url: att.url,
        })),
      }) as Message,
  );

  return {
    transformedMessages,
    shouldSetInitialMessages: true,
  };
}
