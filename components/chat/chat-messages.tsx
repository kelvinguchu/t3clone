import { useState } from "react";
import { GitBranch, Globe } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { AiOutlineCopy } from "react-icons/ai";
import { FiRefreshCw } from "react-icons/fi";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAvailableModels, getModelInfo } from "@/lib/ai-providers";
import { ChatMessageAttachments } from "./chat-message-attachments";

type DisplayMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  id?: string;
  model?: string;
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

export interface ChatMessagesProps {
  messages: DisplayMessage[];
  isLoading: boolean;
  isBrowsing?: boolean;
}

// Web Browsing Indicator Component
function WebBrowsingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg mb-4">
      <div className="relative">
        <Globe className="h-4 w-4 text-green-600 animate-spin" />
        <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
      </div>
      <span className="text-sm text-green-700 font-medium">
        AI is browsing the web...
      </span>
      <div className="flex gap-1 ml-auto">
        <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse" />
        <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse delay-75" />
        <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse delay-150" />
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  isLoading,
  isBrowsing = false,
}: ChatMessagesProps) {
  // Track which assistant message was recently copied
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Track which branch popover is open (by message index)
  const [branchPopover, setBranchPopover] = useState<number | null>(null);

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1"></div>
      <div className="w-full max-w-4xl mx-auto space-y-4 p-6">
        {/* Render conversation messages */}
        {messages.map((msg, index) => {
          // -------------------------------------------------------------
          // Skip rendering the placeholder assistant message that is
          // still empty while the LLM is busy with tool-calls (browsing).
          // We will instead show a dedicated indicator further below.
          // -------------------------------------------------------------
          if (
            msg.role === "assistant" &&
            (msg.content ?? "").trim().length === 0 &&
            isLoading &&
            index === messages.length - 1
          ) {
            return null;
          }

          if (msg.role === "user") {
            return (
              <div key={index} className="flex justify-end mb-4">
                <div className="max-w-[70%] ml-4">
                  {/* User message content */}
                  <div className="p-4 rounded-2xl bg-purple-600 text-white">
                    <div className="whitespace-pre-wrap break-words">
                      <Markdown content={msg.content} />
                    </div>
                  </div>

                  {/* User message attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2">
                      <ChatMessageAttachments
                        attachments={msg.attachments}
                        maxHeight={250}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Assistant message
          const handleCopy = () => {
            navigator.clipboard.writeText(msg.content);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
          };
          const handleRetry = () => {
            if (messages[index - 1]?.role === "user") {
              // Implement retry logic
            }
          };

          // Check if this is the latest assistant message
          const isLatestAssistantMessage = (() => {
            // Find the last assistant message index
            for (let i = messages.length - 1; i >= 0; i--) {
              if (messages[i].role === "assistant") {
                return i === index;
              }
            }
            return false;
          })();

          const isCurrentStreaming = isLoading && index === messages.length - 1;

          return (
            <div key={index} className="flex justify-start mb-6">
              <div className="w-full max-w-4xl mx-auto">
                <div className="whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">
                  <Markdown content={msg.content} />
                  {/* Show streaming cursor for the last assistant message during streaming */}
                  {isLoading &&
                    msg.role === "assistant" &&
                    index === messages.length - 1 && (
                      <span className="inline-block w-2 h-5 bg-purple-500 animate-pulse ml-1" />
                    )}
                </div>

                {/* Assistant message attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <ChatMessageAttachments
                    attachments={msg.attachments}
                    maxHeight={300}
                  />
                )}
                {/* Action buttons (copy / retry / branch) – only once streaming is finished */}
                {!isCurrentStreaming && (
                  <div className="flex items-center gap-4 mt-2 text-gray-500 dark:text-gray-400 text-sm">
                    <button
                      onClick={handleCopy}
                      aria-label="Copy response"
                      className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      {copiedIndex === index ? (
                        <span className="text-green-500 text-[12px] select-none">
                          Copied
                        </span>
                      ) : (
                        <AiOutlineCopy className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={handleRetry}
                      aria-label="Retry"
                      className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      <FiRefreshCw className="h-5 w-5" />
                    </button>
                    {/* Only show branch button for the latest assistant message */}
                    {msg.id && isLatestAssistantMessage && (
                      <Popover
                        open={branchPopover === index}
                        onOpenChange={(o) => setBranchPopover(o ? index : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            aria-label="Branch conversation"
                            className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                          >
                            <GitBranch className="h-5 w-5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 p-4 space-y-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200 dark:border-purple-700 shadow-xl shadow-purple-500/10 dark:shadow-purple-900/20">
                          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide select-none">
                            Choose model to branch with
                          </p>
                          <div className="space-y-1.5">
                            {getAvailableModels().map((mId) => {
                              const info = getModelInfo(mId);
                              return (
                                <button
                                  key={mId}
                                  onClick={() => {
                                    // Implement branch logic
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 text-sm text-left transition-all duration-200 border border-transparent hover:border-purple-200 dark:hover:border-purple-700 group"
                                >
                                  <img
                                    src={info.icon}
                                    alt={info.name}
                                    className="h-5 w-5 rounded-sm"
                                  />
                                  <span className="flex-1 font-medium text-gray-700 dark:text-gray-200 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                                    {info.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    <span className="ml-auto text-xs text-gray-400 select-none uppercase tracking-wide">
                      {msg.model ?? "Model"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Web-browsing & waiting indicators */}
        {isBrowsing && <WebBrowsingIndicator />}

        {(() => {
          // Show the classic typing dots only while waiting for the first
          // tokens – i.e. loading, *not* browsing, and no assistant text yet.
          const lastAssistant = [...messages]
            .reverse()
            .find((m) => m.role === "assistant");
          const hasAssistantContent = lastAssistant
            ? (lastAssistant.content ?? "").trim().length > 0
            : false;
          const showDots = isLoading && !isBrowsing && !hasAssistantContent;
          if (!showDots) return null;
          return (
            <div className="flex justify-start mb-4">
              <div className="max-w-[70%] p-4 rounded-2xl bg-white dark:bg-gray-800 mr-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
