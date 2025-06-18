import { Markdown } from "@/components/ui/markdown";
import { ChatMessageAttachments } from "./chat-message-attachments";

type DisplayMessage = {
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
};

export interface UserMessageProps {
  message: DisplayMessage;
  index: number;
}

/**
 * User Message Component
 * Extracted from chat-messages.tsx
 */
export function UserMessage({ message: msg, index }: UserMessageProps) {
  return (
    <div key={index} className="flex justify-end mb-3 sm:mb-4">
      <div className="max-w-[85%] sm:max-w-[75%] md:max-w-[70%] ml-2 sm:ml-4">
        {/* User message content */}
        <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-purple-600 dark:bg-dark-purple-glow text-white">
          <div className="whitespace-pre-wrap break-words text-sm sm:text-base">
            <Markdown content={msg.content} />
          </div>
        </div>

        {/* User message attachments */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mt-2">
            <ChatMessageAttachments
              attachments={msg.attachments}
              maxHeight={200}
            />
          </div>
        )}
      </div>
    </div>
  );
}
