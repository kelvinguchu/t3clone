import type { Message } from "@ai-sdk/react";
import type { ModelId } from "@/lib/ai-providers";

// Type for display message (matches the one in chat-area.tsx)
export type DisplayMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  id?: string;
  model?: string;
  // Tool usage tracking from database
  toolsUsed?: string[];
  hasToolCalls?: boolean;
  // Reasoning/thinking tokens from AI models
  reasoning?: string;
  // Message parts from AI SDK (for streaming reasoning)
  parts?: Array<{
    type: string;
    text?: string;
    reasoning?: string;
  }>;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    url: string;
    size?: number;
  }>;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
    result?: unknown;
    state: "partial-call" | "call" | "result";
  }>;
  actionSummary?: string;
};

// Type for historical message from database
export interface HistoricalMessageData {
  _id: string;
  _creationTime: number;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string; // Reasoning tokens stored in database
  parentId?: string;
  order: number;
  model?: string;
  tokenCount?: number;
  finishReason?: string;
  toolsUsed?: string[];
  hasToolCalls?: boolean;
  cloned?: boolean;
  isStreaming?: boolean;
  streamId?: string;
  createdAt: number;
  updatedAt: number;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    url: string;
    size: number;
  }>;
  actionSummary?: string;
}

// Extract reasoning from AI SDK message parts
function extractReasoningFromMessage(message: Message): string {
  if (message.role !== "assistant") return "";

  // Type the message with parts property
  const messageWithParts = message as Message & {
    parts?: Array<{
      type: string;
      text?: string;
      textDelta?: string;
      reasoning?: string;
      details?: Array<{ type: string; text?: string }>;
    }>;
  };

  if (!Array.isArray(messageWithParts.parts)) return "";

  const reasoningParts = messageWithParts.parts.filter(
    (part) => part.type === "reasoning",
  );

  if (reasoningParts.length === 0) return "";

  // Extract reasoning from either the reasoning field or details array
  return reasoningParts
    .map((part) => {
      if (part.reasoning) {
        return part.reasoning;
      }
      if (part.details && Array.isArray(part.details)) {
        return part.details
          .filter((detail) => detail.type === "text")
          .map((detail) => detail.text || "")
          .join("");
      }
      return "";
    })
    .join("");
}

// Convert AI SDK messages to display format
export function convertToDisplayMessages(
  effectiveMessages: Message[],
  selectedModel: ModelId,
  historicalMessages?: HistoricalMessageData[],
): DisplayMessage[] {
  const displayMessages = effectiveMessages.map((m) => {
    // Check if this message exists in historical data (has database info)
    const historicalMessage = historicalMessages?.find((hm) => hm._id === m.id);

    // Extract reasoning from message parts (AI SDK format)
    const reasoning = extractReasoningFromMessage(m);

    return {
      role: m.role as DisplayMessage["role"],
      content: m.content,
      // Use Convex message ID if available (needed for branching), otherwise use AI SDK ID
      id: historicalMessage?._id ?? m.id,
      // Use model from database if available, otherwise use current selected model for new messages
      model:
        historicalMessage?.model ??
        (m.role === "assistant" ? selectedModel : undefined),
      // Tool usage data from database (only available for historical messages)
      toolsUsed: historicalMessage?.toolsUsed,
      hasToolCalls: historicalMessage?.hasToolCalls,
      // Reasoning: prefer database reasoning for historical messages, fall back to AI SDK reasoning
      reasoning: historicalMessage?.reasoning || reasoning || undefined,
      // Pass through message parts for streaming reasoning
      parts: (
        m as Message & {
          parts?: Array<{ type: string; text?: string; reasoning?: string }>;
        }
      ).parts,
      attachments:
        m.experimental_attachments?.map((att) => ({
          id: att.url, // Use URL as ID for experimental attachments
          name: att.name ?? "Attachment",
          contentType: att.contentType ?? "application/octet-stream",
          url: att.url,
          size: 0, // Size not available in experimental_attachments
        })) ||
        // Also include attachments from historical messages
        historicalMessage?.attachments?.map((att) => ({
          id: att.id,
          name: att.name,
          contentType: att.contentType,
          url: att.url,
          size: att.size,
        })) ||
        [],
      toolInvocations:
        m.toolInvocations?.map((tool) => ({
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          args: tool.args,
          result: "result" in tool ? tool.result : undefined,
          state: tool.state,
        })) || [],
      actionSummary: historicalMessage?.actionSummary,
    };
  });

  // From now on we rely on the *real* assistant message (which comes with
  // `toolInvocations` set by AI-SDK) to show inline browsing indicators. No
  // need for extra placeholder messages.

  return displayMessages;
}
