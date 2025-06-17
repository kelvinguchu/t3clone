export interface ToolUsageResult {
  toolsUsedInResponse: string[];
  hasAnyToolCalls: boolean;
}

// Detect tool usage from AI response messages
export function detectToolUsage(
  responseMessages: Array<{
    role: string;
    content: unknown;
  }>,
  requestId?: string,
): ToolUsageResult {
  const logPrefix = requestId ? `[${requestId}]` : "[detectToolUsage]";

  const toolsUsedInResponse: string[] = [];
  let hasAnyToolCalls = false;

  // Analyze response messages to detect tool usage
  for (const msg of responseMessages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const part of msg.content as Array<{
        type: string;
        [key: string]: unknown;
      }>) {
        if (part.type === "tool-call") {
          const toolCall = part as {
            type: "tool-call";
            toolName: string;
          };
          if (!toolsUsedInResponse.includes(toolCall.toolName)) {
            toolsUsedInResponse.push(toolCall.toolName);
          }
          hasAnyToolCalls = true;
        }
      }
    }
  }

  return {
    toolsUsedInResponse,
    hasAnyToolCalls,
  };
}
