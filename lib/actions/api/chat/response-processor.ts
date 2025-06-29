import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { ModelId } from "@/lib/ai-providers";

export interface ResponseProcessingResult {
  success: boolean;
  processedMessages: number;
  error?: string;
}

export interface ProcessResponseParams {
  responseMessages: Array<{
    role: string;
    content: unknown;
  }>;
  finalThreadId: string;
  userId: string | null;
  finalSessionId: string | null;
  modelId: ModelId;
  toolsUsedInResponse: string[];
  hasAnyToolCalls: boolean;
  usage?: {
    totalTokens?: number;
  };
  finishReason?: string;
  extractedReasoning?: string;
  fetchOptions?: { token: string };
  requestId?: string;
}

// Process and save AI response messages
export async function processAIResponseMessages({
  responseMessages,
  finalThreadId,
  userId,
  finalSessionId,
  modelId,
  toolsUsedInResponse,
  hasAnyToolCalls,
  usage,
  finishReason,
  extractedReasoning,
  fetchOptions,
  requestId,
}: ProcessResponseParams): Promise<ResponseProcessingResult> {
  const logPrefix = requestId
    ? `[${requestId}]`
    : "[processAIResponseMessages]";

  let processedCount = 0;

  // --- Aggregation helpers for assistant messages ---
  let aggregatedAssistantText = "";
  let aggregatedAssistantReasoning: string | undefined;
  let aggregatedAssistantActionSummary: string | undefined;

  const lastAssistantIndex = (() => {
    for (let i = responseMessages.length - 1; i >= 0; i--) {
      if (responseMessages[i].role === "assistant") return i;
    }
    return -1;
  })();
  // --- End helpers ---

  try {
    // Iterate with index so we know when we're at the final assistant message
    for (let idx = 0; idx < responseMessages.length; idx++) {
      const message = responseMessages[idx];
      // Skip tool messages – they are internal and not supported by Convex schema
      if (message.role === "tool") {
        continue;
      }

      // Type assertion after filtering out tool messages
      const typedMessage = message as {
        role: "assistant" | "system" | "user";
        content: string | Array<{ type: string; [key: string]: unknown }>;
      };

      let localActionSummary: string | undefined;

      if (typedMessage.role === "assistant" || typedMessage.role === "system") {
        // Extract text content and reasoning from assistant/system messages
        let textContent = "";
        let reasoning: string | undefined;
        let reasoningParts: string[] = [];

        if (typeof typedMessage.content === "string") {
          textContent = typedMessage.content;
        } else if (Array.isArray(typedMessage.content)) {
          // Extract text from content parts, skip tool-call parts
          const textParts = typedMessage.content
            .filter((part) => part.type === "text")
            .map((part) => (part as unknown as { text: string }).text);
          textContent = textParts.join("");

          // Extract reasoning from reasoning parts
          reasoningParts = typedMessage.content
            .filter((part) => part.type === "reasoning")
            .map(
              (part) => (part as unknown as { reasoning: string }).reasoning,
            );
          if (reasoningParts.length > 0) {
            reasoning = reasoningParts.join("\n");
          }
        }

        // Also check for reasoning property directly on the message (Groq parsed format)
        const messageWithReasoning = typedMessage as typeof typedMessage & {
          reasoning?: string;
        };
        if (!reasoning && messageWithReasoning.reasoning) {
          reasoning = messageWithReasoning.reasoning;
        }

        // Use the extracted reasoning from the onFinish callback as fallback
        if (
          !reasoning &&
          extractedReasoning &&
          typedMessage.role === "assistant"
        ) {
          reasoning = extractedReasoning;
        }

        // If this assistant message is only a tool-call placeholder we derive an action summary
        if (
          typedMessage.role === "assistant" &&
          (!textContent || textContent.trim() === "")
        ) {
          if (Array.isArray(typedMessage.content)) {
            const toolCallPart = typedMessage.content.find(
              (part) => (part as { type?: string }).type === "tool-call",
            ) as { args?: { query?: string }; toolName?: string } | undefined;

            const q =
              toolCallPart?.args &&
              (toolCallPart.args as { query?: string }).query;
            localActionSummary = q ? `Searched for "${q}"` : "Searched the web";
            textContent = "";
          } else {
            localActionSummary = "Searched the web";
            textContent = "";
          }
        }

        if (typedMessage.role === "assistant") {
          // Aggregate assistant parts – combine greeting, action, and final answer
          if (textContent) {
            aggregatedAssistantText += aggregatedAssistantText
              ? `\n\n${textContent}`
              : textContent;
          }
          if (reasoning) {
            aggregatedAssistantReasoning = aggregatedAssistantReasoning
              ? `${aggregatedAssistantReasoning}\n${reasoning}`
              : reasoning;
          }
          if (!aggregatedAssistantActionSummary && localActionSummary) {
            aggregatedAssistantActionSummary = localActionSummary;
          }

          // If this is NOT the last assistant message, continue without saving yet
          if (idx !== lastAssistantIndex) {
            continue;
          }

          // Replace local variables with aggregated values for final save
          textContent = aggregatedAssistantText;
          reasoning = aggregatedAssistantReasoning;
          localActionSummary = aggregatedAssistantActionSummary;
        }

        // Save the message to Convex with tool usage information and reasoning
        if (
          typedMessage.role === "assistant" ||
          typedMessage.role === "system"
        ) {
          if (userId) {
            await fetchMutation(
              api.messages.addMessage,
              {
                threadId: finalThreadId as Id<"threads">,
                content: textContent,
                reasoning:
                  typedMessage.role === "assistant" ? reasoning : undefined,
                role: typedMessage.role as "user" | "assistant" | "system",
                model: typedMessage.role === "assistant" ? modelId : undefined,
                tokenCount:
                  typedMessage.role === "assistant"
                    ? usage?.totalTokens
                    : undefined,
                finishReason:
                  typedMessage.role === "assistant" ? finishReason : undefined,
                toolsUsed:
                  typedMessage.role === "assistant" &&
                  toolsUsedInResponse.length > 0
                    ? toolsUsedInResponse
                    : undefined,
                hasToolCalls:
                  typedMessage.role === "assistant"
                    ? hasAnyToolCalls
                    : undefined,
                actionSummary:
                  typedMessage.role === "assistant"
                    ? localActionSummary
                    : undefined,
              },
              fetchOptions,
            );
          } else {
            if (!finalSessionId) {
              throw new Error("Session ID required for anonymous message");
            }

            await fetchMutation(api.messages.createAnonymousMessage, {
              threadId: finalThreadId as Id<"threads">,
              sessionId: finalSessionId,
              content: textContent,
              reasoning:
                typedMessage.role === "assistant" ? reasoning : undefined,
              role: typedMessage.role as "user" | "assistant" | "system",
              model: typedMessage.role === "assistant" ? modelId : undefined,
              toolsUsed:
                typedMessage.role === "assistant" &&
                toolsUsedInResponse.length > 0
                  ? toolsUsedInResponse
                  : undefined,
              hasToolCalls:
                typedMessage.role === "assistant" ? hasAnyToolCalls : undefined,
              actionSummary:
                typedMessage.role === "assistant"
                  ? localActionSummary
                  : undefined,
            });
          }
          processedCount++;
        }
      }
    }

    return {
      success: true,
      processedMessages: processedCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(
      `${logPrefix} CHAT_API - Background message saving failed:`,
      error,
    );

    return {
      success: false,
      processedMessages: processedCount,
      error: errorMessage,
    };
  }
}
