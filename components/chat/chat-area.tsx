"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { ChatInput } from "./chat-input";
// Remove direct KV import - use API instead
import {
  Sparkles,
  Code2,
  Lightbulb,
  Wand2,
  Brain,
  Rocket,
  UserIcon,
  GitBranch,
} from "lucide-react";
import { useAnonymousSessionReactive } from "@/lib/hooks/use-anonymous-session-reactive";
import { useChat } from "@/lib/hooks/use-chat";
import { Markdown } from "@/components/ui/markdown";
import type { Id } from "@/convex/_generated/dataModel";
import { getModelInfo, type ModelId } from "@/lib/ai-providers";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AiOutlineCopy } from "react-icons/ai";
import { FiRefreshCw } from "react-icons/fi";
import { generateThreadTitle, shouldUpdateTitle } from "@/lib/title-generator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAvailableModels } from "@/lib/ai-providers";

const quickPrompts = [
  "Explain quantum computing",
  "Write a Python function",
  "Help me brainstorm ideas",
  "Analyze this data",
  "Create a story",
  "Debug my code",
  "Plan my day",
  "Write an email",
];

interface ChatAreaProps {
  initialThreadId?: string | null;
}

type DisplayMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  id?: string;
  model?: string;
};

export function ChatArea({
  initialThreadId = null,
}: Readonly<ChatAreaProps> = {}) {
  const { isLoaded, user } = useUser();
  const [message, setMessage] = useState("");
  const [selectedModel, setSelectedModel] =
    useState<ModelId>("gemini-2.0-flash");

  const router = useRouter();

  // Anonymous session reactive hook for state/info
  const {
    sessionId: anonSessionId,
    isAnonymous,
    remainingMessages,
    canSendMessage,
  } = useAnonymousSessionReactive();

  // Chat functionality
  const { messages, isLoading, sendMessage, error, threadId } = useChat({
    modelId: selectedModel,
    initialThreadId,
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

  // If a new thread is created (no initialThreadId) navigate to it
  useEffect(() => {
    if (!initialThreadId && threadId) {
      router.push(`/chat/${threadId}`);
    }
  }, [threadId, initialThreadId, router]);

  // Always include anonSessionId if we have it. This allows freshly auth'd
  // users to access their just-promoted anonymous threads before the
  // migration finishes, preventing a transient 401/404 that forced a refresh.
  const historicalQueryArgs = initialThreadId
    ? isAnonymous
      ? anonSessionId
        ? {
            threadId: initialThreadId as Id<"threads">,
            sessionId: anonSessionId,
          }
        : "skip"
      : {
          threadId: initialThreadId as Id<"threads">,
        }
    : "skip";

  const historicalMessages = useQuery(
    api.messages.getThreadMessages,
    historicalQueryArgs as unknown as
      | { threadId: Id<"threads">; sessionId?: string }
      | "skip",
  );

  // Fetch thread metadata to get stored model, so branching loads correct model
  const threadMeta = useQuery(
    api.threads.getThread,
    initialThreadId
      ? isAnonymous
        ? anonSessionId
          ? {
              threadId: initialThreadId as Id<"threads">,
              sessionId: anonSessionId,
            }
          : "skip"
        : {
            threadId: initialThreadId as Id<"threads">,
          }
      : "skip",
  );

  // When thread metadata arrives, update selected model to thread's model
  useEffect(() => {
    if (threadMeta?.model && threadMeta.model !== selectedModel) {
      setSelectedModel(threadMeta.model as ModelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadMeta?.model]);

  // Load and cache conversation context when thread changes
  useEffect(() => {
    const loadConversationContext = async () => {
      if (!initialThreadId) return;

      try {
        // Check if we have cached context via API
        const response = await fetch(
          `/api/cache/messages?threadId=${initialThreadId}`,
        );
        if (response.ok) {
          const { data: cachedSummary } = await response.json();

          if (cachedSummary && cachedSummary.hasMessages) {
            console.log("📥 Found cached conversation context", {
              threadId: initialThreadId,
              messageCount: cachedSummary.messageCount,
              model: cachedSummary.model,
              lastUpdated: new Date(cachedSummary.lastUpdated).toLocaleString(),
            });
          } else {
            console.log(
              "💾 No cached context found, will be created as messages are sent",
            );
          }
        }
      } catch (error) {
        console.error("Failed to check conversation context:", error);
      }
    };

    if (initialThreadId) {
      loadConversationContext();
    }
  }, [initialThreadId]);

  const combinedMessages: DisplayMessage[] = historicalMessages
    ? historicalMessages.map((m) => ({
        role: m.role,
        content: m.content,
        model: (m as { model?: string }).model ?? undefined,
        id: (m as { _id?: string })._id as string | undefined,
      }))
    : [];

  // Debug logging for message deduplication
  console.log("🔍 Message deduplication debug:", {
    isLoading,
    historicalCount: combinedMessages.length,
    liveCount: messages.length,
    historicalMessages: combinedMessages.map((m) => ({
      role: m.role,
      id: m.id,
      contentStart: m.content.slice(0, 30),
    })),
    liveMessages: messages.map((m) => ({
      role: m.role,
      id: m.id,
      contentStart: m.content.slice(0, 30),
    })),
  });

  // Simple and robust deduplication approach
    const liveMessagesWithModel: DisplayMessage[] = messages.map((m) => ({
      role: m.role as DisplayMessage["role"],
      content: m.content,
      model: m.role === "assistant" ? selectedModel : undefined,
      id: m.id,
    }));

  // Always prefer historical messages when available, only show live messages when necessary
  let displayMessages: DisplayMessage[];

  if (combinedMessages.length === 0) {
    // No historical messages, show live messages
    displayMessages = liveMessagesWithModel;
  } else if (isLoading) {
    // During streaming: show historical + only the latest streaming message
    const historicalContent = new Set(
      combinedMessages.map((m) => `${m.role}:${m.content.trim()}`),
    );

    const streamingMessages = liveMessagesWithModel.filter(
      (m) => !historicalContent.has(`${m.role}:${m.content.trim()}`),
    );

    displayMessages = [...combinedMessages, ...streamingMessages];
  } else {
    // Not streaming: show only historical messages (they include everything)
    displayMessages = combinedMessages;
  }

  // Update debug log with final count
  console.log("🔍 Final display messages:", {
    count: displayMessages.length,
    messages: displayMessages.map((m, i) => ({
      index: i,
      role: m.role,
      id: m.id,
      contentStart: m.content.slice(0, 30),
    })),
  });

  const hasMessages = displayMessages.length > 0;

  // Use state to prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getUserDisplayName = () => {
    if (!mounted || !isLoaded) return "there";
    if (isAnonymous) return "there";
    return (
      user?.firstName ??
      user?.fullName?.split(" ")[0] ??
      user?.emailAddresses[0]?.emailAddress.split("@")[0] ??
      "there"
    );
  };

  const getUserGreeting = () => {
    if (!mounted || !isLoaded) return "Hey there!";
    if (isAnonymous) {
      return `Hey there! (${remainingMessages}/10 messages left)`;
    }
    return `Hey ${getUserDisplayName()}!`;
  };

  const getUserSubtext = () => {
    if (!mounted || !isLoaded) return "Ready to explore ideas together?";
    if (isAnonymous) {
      if (!canSendMessage) {
        return "Sign up to continue chatting or wait 24 hours for reset";
      }
      return "Sign up for unlimited conversations and message history";
    }
    return "Ready to explore ideas together?";
  };

  const handleQuickPrompt = (prompt: string) => {
    if (isAnonymous && !canSendMessage) {
      // Don't set message if rate limited
      return;
    }
    if (isLoading) {
      // Don't set message if currently loading
      return;
    }
    setMessage(prompt);
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    if (isAnonymous && !canSendMessage) {
      // Don't send if rate limited
      return;
    }
    if (isLoading) {
      // Don't send if already loading
      return;
    }

    const userMessage = message.trim();
    setMessage(""); // Clear input immediately

    try {
      // Cache user message immediately via API
      if (threadId) {
        fetch("/api/cache/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            message: {
              role: "user",
              content: userMessage,
              timestamp: Date.now(),
              model: selectedModel,
              messageId: `user-${Date.now()}`,
            },
            sessionId: isAnonymous ? anonSessionId : undefined,
          }),
        }).catch((error) => console.warn("Failed to cache message:", error));
      }

      sendMessage(userMessage);

      // Auto-update thread title if it's still "New Chat"
      if (threadId && threadMeta && shouldUpdateTitle(threadMeta.title)) {
        try {
          const newTitle = await generateThreadTitle(userMessage);
          await updateThreadMutation({
            threadId: threadId as Id<"threads">,
            title: newTitle,
            ...(isAnonymous && anonSessionId
              ? { sessionId: anonSessionId }
              : {}),
          });
          console.log("🏷️ Auto-updated thread title:", { threadId, newTitle });
        } catch (error) {
          console.warn("Failed to auto-update thread title:", error);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Message will be restored via the error state
      setMessage(userMessage);
    }
  };

  const modelInfo = getModelInfo(selectedModel);

  const getModelThemeClasses = () => {
    switch (modelInfo.theme) {
      case "blue":
        return "from-blue-50/40 via-white to-cyan-50/40 dark:from-blue-950/20 dark:via-gray-950 dark:to-cyan-950/20";
      case "green":
        return "from-green-50/40 via-white to-emerald-50/40 dark:from-green-950/20 dark:via-gray-950 dark:to-emerald-950/20";
      case "orange":
        return "from-orange-50/40 via-white to-amber-50/40 dark:from-orange-950/20 dark:via-gray-950 dark:to-amber-950/20";
      default:
        return "from-blue-50/40 via-white to-cyan-50/40 dark:from-blue-950/20 dark:via-gray-950 dark:to-cyan-950/20";
    }
  };

  const getFloatingElementColors = () => {
    switch (modelInfo.theme) {
      case "blue":
        return {
          primary: "bg-blue-200/30 dark:bg-blue-800/20",
          secondary: "bg-cyan-200/30 dark:bg-cyan-800/20",
        };
      case "green":
        return {
          primary: "bg-green-200/30 dark:bg-green-800/20",
          secondary: "bg-emerald-200/30 dark:bg-emerald-800/20",
        };
      case "orange":
        return {
          primary: "bg-orange-200/30 dark:bg-orange-800/20",
          secondary: "bg-amber-200/30 dark:bg-amber-800/20",
        };
      default:
        return {
          primary: "bg-blue-200/30 dark:bg-blue-800/20",
          secondary: "bg-cyan-200/30 dark:bg-cyan-800/20",
        };
    }
  };

  const floatingColors = getFloatingElementColors();

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Track which assistant message was recently copied
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Track which branch popover is open (by message index)
  const [branchPopover, setBranchPopover] = useState<number | null>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [displayMessages]);

  // Auto-scroll during streaming for smooth experience
  useEffect(() => {
    if (isLoading && messagesContainerRef.current) {
      const scrollToBottom = () => {
        messagesContainerRef.current!.scrollTop =
          messagesContainerRef.current!.scrollHeight;
      };

      // Smooth scroll during streaming
      const scrollInterval = setInterval(scrollToBottom, 100);
      return () => clearInterval(scrollInterval);
    }
  }, [isLoading]);

  // Cache assistant messages when streaming completes
  useEffect(() => {
    const cacheAssistantMessages = async () => {
      if (!isLoading && threadId && messages.length > 0) {
        // Find the latest assistant message that isn't cached yet
        const lastMessage = messages[messages.length - 1];

        if (lastMessage?.role === "assistant" && lastMessage.content.trim()) {
          try {
            await fetch("/api/cache/messages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                threadId,
                message: {
                  role: "assistant",
                  content: lastMessage.content,
                  timestamp: Date.now(),
                  model: selectedModel,
                  messageId: lastMessage.id || `assistant-${Date.now()}`,
                },
                sessionId: isAnonymous ? anonSessionId : undefined,
              }),
            });
            console.log("📝 Cached assistant message via API", {
              threadId,
              messageLength: lastMessage.content.length,
              model: selectedModel,
            });

            // Auto-update thread title from AI response if still "New Chat"
            if (threadMeta && shouldUpdateTitle(threadMeta.title)) {
              try {
                const newTitle = await generateThreadTitle(lastMessage.content);
                await updateThreadMutation({
                  threadId: threadId as Id<"threads">,
                  title: newTitle,
                  ...(isAnonymous && anonSessionId
                    ? { sessionId: anonSessionId }
                    : {}),
                });
                console.log("🏷️ Auto-updated thread title from AI response:", {
                  threadId,
                  newTitle,
                });
              } catch (error) {
                console.warn(
                  "Failed to auto-update thread title from AI response:",
                  error,
                );
              }
            }
          } catch (error) {
            console.error("Failed to cache assistant message:", error);
          }
        }
      }
    };

    // Only cache when streaming is complete
    if (!isLoading) {
      cacheAssistantMessages();
    }
  }, [
    isLoading,
    messages,
    threadId,
    selectedModel,
    anonSessionId,
    isAnonymous,
  ]);

  // Branching mutation
  const branchThread = useMutation(api.threads.branchThread);

  // Thread update mutation for auto-title generation
  const updateThreadMutation = useMutation(api.threads.updateThread);

  const handleBranch = async (modelId: ModelId, messageId: string) => {
    try {
      if (!threadId) return;
      const newId = await branchThread({
        sourceThreadId: threadId as Id<"threads">,
        branchFromMessageId: messageId as Id<"messages">,
        model: modelId,
        ...(isAnonymous && anonSessionId ? { sessionId: anonSessionId } : {}),
      });
      if (newId) {
        router.push(`/chat/${newId}`);
        setBranchPopover(null);
      }
    } catch (e) {
      console.error("Failed to branch thread", e);
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full min-h-0 rounded-tl-[1rem] bg-gradient-to-br transition-all duration-1000 border-2 border-l-purple-200 dark:border-t-purple-800 border-t-purple-200 dark:border-l-purple-800 ${getModelThemeClasses()}`}
    >
      {/* Scrollable Messages Area */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        ref={messagesContainerRef}
      >
        {hasMessages ? (
          /* Chat Messages Area */
          <div className="flex flex-col min-h-full">
            <div className="flex-1"></div>
            <div className="w-full max-w-4xl mx-auto space-y-4 p-6">
              {displayMessages.map((msg, index) => {
                if (msg.role === "user") {
                  return (
                    <div key={index} className="flex justify-end mb-4">
                      <div className="max-w-[70%] p-4 rounded-2xl bg-purple-600 text-white ml-4">
                        <div className="whitespace-pre-wrap break-words">
                          <Markdown content={msg.content} />
                        </div>
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
                  if (displayMessages[index - 1]?.role === "user") {
                    sendMessage(displayMessages[index - 1].content);
                  }
                };

                // Check if this is the latest assistant message
                const isLatestAssistantMessage = (() => {
                  // Find the last assistant message index
                  for (let i = displayMessages.length - 1; i >= 0; i--) {
                    if (displayMessages[i].role === "assistant") {
                      return i === index;
                    }
                  }
                  return false;
                })();

                return (
                  <div key={index} className="flex justify-start mb-6">
                    <div className="w-full max-w-4xl mx-auto">
                      <div className="whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">
                        <Markdown content={msg.content} />
                        {/* Show streaming cursor for the last assistant message during streaming */}
                        {isLoading &&
                          msg.role === "assistant" &&
                          index === displayMessages.length - 1 && (
                            <span className="inline-block w-2 h-5 bg-purple-500 animate-pulse ml-1" />
                          )}
                      </div>
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
                            onOpenChange={(o) =>
                              setBranchPopover(o ? index : null)
                            }
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
                                      onClick={() => handleBranch(mId, msg.id!)}
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
                          {msg.model ?? selectedModel}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="max-w-[70%] p-4 rounded-2xl bg-white dark:bg-gray-800 mr-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex justify-center mb-4">
                  <div className="max-w-[70%] p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <div className="text-sm text-red-600 dark:text-red-400">
                      {typeof error === "string" ? error : "An error occurred"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Welcome Screen */
          <div className="h-full flex flex-col justify-center items-center p-6 relative">
            {/* Floating Background Elements with Model Theme */}
            {!hasMessages && (
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className={`absolute top-1/4 left-1/4 w-32 h-32 rounded-full blur-3xl animate-pulse transition-colors duration-1000 ${floatingColors.primary}`}
                />
                <div
                  className={`absolute bottom-1/3 right-1/4 w-24 h-24 rounded-full blur-2xl animate-pulse delay-1000 transition-colors duration-1000 ${floatingColors.secondary}`}
                />
                <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-pink-200/20 dark:bg-pink-800/10 rounded-full blur-xl animate-pulse delay-2000" />
              </div>
            )}

            <div className="flex-1 flex flex-col justify-center items-center">
              {/* Central Welcome Area */}
              <div className="text-center mb-8 z-10">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 shadow-lg shadow-purple-500/25 animate-bounce">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 shadow-lg shadow-blue-500/25 animate-bounce delay-300">
                    <Brain className="h-6 w-6 text-white" />
                  </div>
                  {(() => {
                    const show = mounted && isLoaded && isAnonymous;
                    return (
                      <div
                        className={`p-2 rounded-xl ${
                          show
                            ? "bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/25 animate-bounce delay-500"
                            : "opacity-0"
                        }`}
                        aria-hidden={show ? "false" : "true"}
                      >
                        {show && <UserIcon className="h-6 w-6 text-white" />}
                      </div>
                    );
                  })()}
                  <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 shadow-lg shadow-pink-500/25 animate-bounce delay-700">
                    <Wand2 className="h-6 w-6 text-white" />
                  </div>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                  <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-purple-800 bg-clip-text text-transparent">
                    {getUserGreeting()}
                  </span>
                </h1>
                <p
                  className={`font-medium mb-8 ${
                    isAnonymous && !canSendMessage
                      ? "text-red-600/80 dark:text-red-400/80"
                      : isAnonymous
                        ? "text-orange-600/80 dark:text-orange-400/80"
                        : "text-purple-600/80 dark:text-purple-400/80"
                  }`}
                >
                  {getUserSubtext()}
                </p>

                {/* Sign up prompt for anonymous users with low messages */}
                {mounted && isAnonymous && remainingMessages <= 3 && (
                  <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border border-orange-200 dark:border-orange-700">
                    <p className="text-sm text-orange-800 dark:text-orange-200 font-medium mb-2">
                      ⚡ Running low on messages!
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      Sign up to get unlimited conversations, message history,
                      and access to all features.
                    </p>
                  </div>
                )}

                {/* Floating Quick Prompts */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
                  {quickPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickPrompt(prompt)}
                      disabled={(isAnonymous && !canSendMessage) || isLoading}
                      className={`px-3 py-1.5 text-xs rounded-full transition-all duration-200 border ${
                        (isAnonymous && !canSendMessage) || isLoading
                          ? "bg-gray-100/80 dark:bg-gray-900/20 text-gray-400 dark:text-gray-600 border-gray-200/50 dark:border-gray-800/30 cursor-not-allowed"
                          : "bg-purple-100/80 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-200/80 dark:hover:bg-purple-800/30 hover:scale-105 border-purple-200/50 dark:border-purple-800/30 hover:border-purple-300 dark:hover:border-purple-700"
                      }`}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Decorative Elements */}
              <div className="absolute bottom-20 left-10 opacity-30">
                <Rocket className="h-4 w-4 text-purple-400 animate-pulse" />
              </div>
              <div className="absolute top-20 right-16 opacity-30">
                <Code2 className="h-4 w-4 text-blue-400 animate-pulse delay-500" />
              </div>
              <div className="absolute bottom-32 right-12 opacity-30">
                <Lightbulb className="h-4 w-4 text-yellow-400 animate-pulse delay-1000" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Chat Input at Bottom */}
      <div className="flex-shrink-0">
        <ChatInput
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          message={message}
          onMessageChange={setMessage}
          onSend={handleSend}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
