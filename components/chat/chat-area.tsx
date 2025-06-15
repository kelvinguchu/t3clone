"use client";

import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useUser } from "@clerk/nextjs";
import { ChatInput } from "./chat-input";
import { ChatWelcomeScreen } from "./chat-welcome-screen";
import { ChatMessages } from "./chat-messages";
import { useAnonymousSessionReactive } from "@/lib/hooks/use-anonymous-session-reactive";
import { useChat } from "@/lib/hooks/use-chat";
import type { Id } from "@/convex/_generated/dataModel";
import { getModelInfo, type ModelId } from "@/lib/ai-providers";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { generateThreadTitle, shouldUpdateTitle } from "@/lib/title-generator";
import type { Message } from "@ai-sdk/react";
import type { Doc } from "@/convex/_generated/dataModel";

interface ChatAreaProps {
  initialThreadId?: string | null;
  selectedModel: ModelId;
  onModelChange: (model: ModelId) => void;
}

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

type ConvexMessage = Doc<"messages"> & {
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    url: string;
    size?: number;
  }>;
};

const ChatArea = memo(function ChatArea({
  initialThreadId = null,
  selectedModel,
  onModelChange,
}: Readonly<ChatAreaProps>) {
  console.log("[ChatArea] RENDER - Component rendered", {
    initialThreadId,
    selectedModel,
    timestamp: new Date().toISOString(),
  });

  const router = useRouter();
  const { user } = useUser();

  // Single call to useAnonymousSessionReactive to prevent duplicate subscriptions
  const {
    sessionId: anonSessionId,
    isAnonymous,
    canSendMessage,
    remainingMessages,
  } = useAnonymousSessionReactive();

  // Always include anonSessionId if we have it. This allows freshly auth'd
  // users to access their just-promoted anonymous threads before the
  // migration finishes, preventing a transient 401/404 that forced a refresh.
  const historicalQueryArgs = useMemo(() => {
    if (!initialThreadId) return "skip";

    if (isAnonymous) {
      return anonSessionId
        ? {
            threadId: initialThreadId as Id<"threads">,
            sessionId: anonSessionId,
          }
        : "skip";
    }

    return { threadId: initialThreadId as Id<"threads"> };
  }, [initialThreadId, isAnonymous, anonSessionId]);

  const historicalMessages = useQuery(
    api.messages.getThreadMessagesWithAttachments,
    historicalQueryArgs as unknown as
      | { threadId: Id<"threads">; sessionId?: string }
      | "skip",
  );

  const [initialMessages, setInitialMessages] = useState<Message[] | undefined>(
    undefined,
  );

  // Memoize the initial messages transformation to prevent unnecessary recalculations
  const transformedInitialMessages = useMemo(() => {
    if (!historicalMessages || initialMessages !== undefined) return null;

    console.log(
      "[ChatArea] INITIAL_MESSAGES - Setting initial messages from historical data",
      {
        historicalCount: historicalMessages.length,
        firstMessage: historicalMessages[0]
          ? {
              role: historicalMessages[0].role,
              content: historicalMessages[0].content.substring(0, 50) + "...",
              hasAttachments: historicalMessages[0].attachments?.length > 0,
            }
          : null,
      },
    );

    return historicalMessages.map(
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
  }, [historicalMessages, initialMessages]);

  useEffect(() => {
    if (transformedInitialMessages) {
      setInitialMessages(transformedInitialMessages);
    }
  }, [transformedInitialMessages]);

  // Memoize the onError callback to prevent useChat from recreating
  const onChatError = useCallback((error: Error) => {
    console.error("[ChatArea] CHAT_ERROR - Error in chat:", error);
  }, []);

  // Use the chat hook only for its sendMessage helper.
  const {
    sendMessage,
    threadId,
    messages: hookMessages,
    isLoading: hookLoading,
  } = useChat({
    modelId: selectedModel,
    initialThreadId,
    initialMessages,
    onError: onChatError,
  });

  // Once we have a threadId (possibly created by this send), subscribe to the
  // real-time Convex messages.
  const dynamicQueryArgs = useMemo(() => {
    if (!threadId) return "skip";

    if (isAnonymous) {
      return anonSessionId
        ? { threadId: threadId as Id<"threads">, sessionId: anonSessionId }
        : "skip";
    }

    return { threadId: threadId as Id<"threads"> };
  }, [threadId, isAnonymous, anonSessionId]);

  const realtimeMessages = useQuery(
    api.messages.getThreadMessagesWithAttachments,
    dynamicQueryArgs as unknown as
      | { threadId: Id<"threads">; sessionId?: string }
      | "skip",
  );

  const liveMessages: ConvexMessage[] = (realtimeMessages ||
    historicalMessages ||
    []) as ConvexMessage[];

  const effectiveMessages =
    liveMessages.length > 0 ? liveMessages : hookMessages;

  // Detect if assistant is currently streaming based on the isStreaming flag.
  const isLoading = useMemo(() => {
    if (hookLoading) return true;
    return effectiveMessages.some(
      (m) => (m as { isStreaming?: boolean }).isStreaming,
    );
  }, [hookLoading, effectiveMessages]);

  // Detect web-browsing phase: when a generation is in-progress, the last assistant
  // message exists but is still empty (Gemini/LLM has not emitted any tokens yet).
  // This happens while the model is busy executing tool calls (e.g. Browserbase).
  const lastAssistantMessage = useMemo(() => {
    for (let i = effectiveMessages.length - 1; i >= 0; i--) {
      if (effectiveMessages[i].role === "assistant")
        return effectiveMessages[i];
    }
    return null;
  }, [effectiveMessages]);

  const isBrowsing = useMemo(() => {
    if (!isLoading || !lastAssistantMessage) return false;
    return (lastAssistantMessage.content ?? "").trim().length === 0;
  }, [isLoading, lastAssistantMessage]);

  console.log("[ChatArea] MESSAGES_STATE - Current messages state", {
    messagesCount: effectiveMessages.length,
    isLoading,
  });

  // If a new thread is created (no initialThreadId) navigate to it
  useEffect(() => {
    if (!initialThreadId && threadId) {
      router.push(`/chat/${threadId}`);
    }
  }, [threadId, initialThreadId, router]);

  // Memoize thread metadata query args
  const threadMetaQueryArgs = useMemo(() => {
    if (!initialThreadId) return "skip";

    if (isAnonymous) {
      return anonSessionId
        ? {
            threadId: initialThreadId as Id<"threads">,
            sessionId: anonSessionId,
          }
        : "skip";
    }

    return { threadId: initialThreadId as Id<"threads"> };
  }, [initialThreadId, isAnonymous, anonSessionId]);

  // Fetch thread metadata to get stored model, so branching loads correct model
  const threadMeta = useQuery(
    api.threads.getThread,
    threadMetaQueryArgs as unknown as
      | { threadId: Id<"threads">; sessionId?: string }
      | "skip",
  );

  // When thread metadata arrives, update selected model to thread's model
  useEffect(() => {
    if (threadMeta?.model && threadMeta.model !== selectedModel) {
      onModelChange(threadMeta.model as ModelId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadMeta?.model]);

  // Memoize the conversation context loading function
  const loadConversationContext = useCallback(async () => {
    if (!initialThreadId) return;

    try {
      // Check if we have cached context via API
      const response = await fetch(
        `/api/cache/messages?threadId=${initialThreadId}`,
      );
      if (response.ok) {
        const { data: cachedSummary } = await response.json();

        if (cachedSummary && cachedSummary.hasMessages) {
          // Found cached conversation context
        } else {
          // No cached context found, will be created as messages are sent
        }
      }
    } catch {
      // Failed to check conversation context
    }
  }, [initialThreadId]);

  // Load and cache conversation context when thread changes
  useEffect(() => {
    if (initialThreadId) {
      loadConversationContext();
    }
  }, [initialThreadId, loadConversationContext]);

  // The `useChat` hook now manages all messages, initialized with historical data.
  // We no longer need to manually combine historical and live messages.
  const displayMessages: DisplayMessage[] = useMemo(() => {
    return effectiveMessages.map((m) => ({
      role: m.role as DisplayMessage["role"],
      content: m.content,
      id: (m as { _id?: string })._id,
      model: m.role === "assistant" ? selectedModel : undefined,
      attachments:
        "attachments" in m && Array.isArray((m as ConvexMessage).attachments)
          ? (m as ConvexMessage).attachments!.map(
              (att: {
                id: string;
                name: string;
                contentType: string;
                url: string;
                size?: number;
              }) => ({
                id: att.id,
                name: att.name,
                contentType: att.contentType,
                url: att.url,
                size: att.size ?? 0,
              }),
            )
          : [],
      toolInvocations: [],
    }));
  }, [effectiveMessages, selectedModel]);

  console.log("[ChatArea] DISPLAY_MESSAGES - Processed messages for display", {
    displayCount: displayMessages.length,
    messagesWithAttachments: displayMessages.filter(
      (m) => m.attachments && m.attachments.length > 0,
    ).length,
    attachmentDetails: displayMessages
      .filter((m) => m.attachments && m.attachments.length > 0)
      .map((m) => ({
        messageId: m.id,
        attachmentCount: m.attachments?.length || 0,
        attachmentTypes: m.attachments?.map((a) => a.contentType) || [],
      })),
  });

  const hasMessages = displayMessages.length > 0;

  // Memoize mounted state to prevent unnecessary re-renders
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize user display functions
  const getUserDisplayName = useCallback(() => {
    if (!user) return "Guest";
    return (
      user.fullName ||
      user.firstName ||
      user.emailAddresses[0]?.emailAddress.split("@")[0] ||
      "there"
    );
  }, [user]);

  const getUserGreeting = useCallback(() => {
    if (!mounted || !user) return "Hey there!";
    if (isAnonymous) {
      return `Hey there! (${remainingMessages}/10 messages left)`;
    }
    return `Hey ${getUserDisplayName()}!`;
  }, [mounted, user, isAnonymous, remainingMessages, getUserDisplayName]);

  const getUserSubtext = useCallback(() => {
    if (!mounted || !user) return "Ready to explore ideas together?";
    if (isAnonymous) {
      if (!canSendMessage) {
        return "Sign up to continue chatting or wait 24 hours for reset";
      }
      return "Sign up for unlimited conversations and message history";
    }
    return "Ready to explore ideas together?";
  }, [mounted, user, isAnonymous, canSendMessage]);

  // Quick-prompt handling – we just forward the preset down to ChatInput so
  // that the heavy ChatArea component does not re-render on every keystroke.
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);

  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      if (isAnonymous && !canSendMessage) return; // rate-limited
      if (isLoading) return; // currently generating

      setPrefillMessage(prompt);
    },
    [isAnonymous, canSendMessage, isLoading],
  );

  // Thread update mutation for auto-title generation
  const updateThreadMutation = useMutation(api.threads.updateThread);

  const handleSend = useCallback(
    async (
      message: string,
      attachmentIds?: string[],
      attachmentPreviews?: Array<{
        id: string;
        name: string;
        contentType: string;
        url: string;
        size: number;
      }>,
      options?: { enableWebBrowsing?: boolean },
    ) => {
      console.log("[ChatArea] HANDLE_SEND - Send initiated", {
        userMessage: message.substring(0, 50) + "...",
        hasAttachments: !!(attachmentIds && attachmentIds.length > 0),
        attachmentIds: attachmentIds || [],
        hasAttachmentPreviews: !!(
          attachmentPreviews && attachmentPreviews.length > 0
        ),
        attachmentPreviewCount: attachmentPreviews?.length || 0,
        enableWebBrowsing: options?.enableWebBrowsing,
        optionsObject: options,
        timestamp: new Date().toISOString(),
      });

      if (!message.trim() && (!attachmentIds || attachmentIds.length === 0)) {
        console.log("[ChatArea] HANDLE_SEND - Blocked: no content");
        return;
      }

      // Log attachment preview data for the current message
      if (attachmentPreviews && attachmentPreviews.length > 0) {
        console.log(
          "[ChatArea] HANDLE_SEND - Processing message with attachments:",
          {
            attachmentCount: attachmentPreviews.length,
            attachments: attachmentPreviews.map((a) => ({
              id: a.id,
              name: a.name,
              contentType: a.contentType,
              size: a.size,
            })),
          },
        );
      } else {
        console.log(
          "[ChatArea] HANDLE_SEND - Processing message without attachments",
        );
      }

      // Cache user message for thread title generation
      if (initialThreadId) {
        console.log(
          "[ChatArea] HANDLE_SEND - Caching user message for thread:",
          initialThreadId,
        );
        try {
          await fetch("/api/cache/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId: initialThreadId,
              message: {
                role: "user",
                content: message,
                timestamp: Date.now(),
                model: selectedModel,
                messageId: `user-${Date.now()}`,
              },
              sessionId: isAnonymous ? anonSessionId : undefined,
            }),
          });
        } catch (error) {
          console.error(
            "[ChatArea] HANDLE_SEND - Error caching user message:",
            error,
          );
        }
      }

      try {
        console.log(
          "[ChatArea] HANDLE_SEND - Calling sendMessage with experimental_attachments",
        );

        // Convert attachment previews to experimental_attachments format for AI SDK
        const experimentalAttachments = attachmentPreviews?.map((preview) => ({
          name: preview.name,
          contentType: preview.contentType,
          url: preview.url,
        }));

        console.log(
          "[ChatArea] HANDLE_SEND - Experimental attachments:",
          experimentalAttachments,
        );

        console.log(
          "[ChatArea] HANDLE_SEND - About to call sendMessage with:",
          {
            message: message.substring(0, 50) + "...",
            attachmentIds,
            options: {
              experimental_attachments: experimentalAttachments,
              enableWebBrowsing: options?.enableWebBrowsing,
            },
          },
        );

        sendMessage(message, attachmentIds, {
          experimental_attachments: experimentalAttachments,
          enableWebBrowsing: options?.enableWebBrowsing,
        });

        console.log(
          "[ChatArea] HANDLE_SEND - sendMessage completed successfully",
        );

        // Auto-update thread title if it's still "New Chat"
        if (threadId && threadMeta && shouldUpdateTitle(threadMeta.title)) {
          console.log("[ChatArea] Auto-updating thread title");
          try {
            const newTitle = await generateThreadTitle(message);
            await updateThreadMutation({
              threadId: threadId as Id<"threads">,
              title: newTitle,
              ...(isAnonymous && anonSessionId
                ? { sessionId: anonSessionId }
                : {}),
            });
            console.log("[ChatArea] Thread title updated to:", newTitle);
            // Auto-updated thread title
          } catch (error) {
            console.error(
              "[ChatArea] Failed to auto-update thread title:",
              error,
            );
            // Failed to auto-update thread title
          }
        }
      } catch (error) {
        console.error("[ChatArea] HANDLE_SEND - Error sending message:", error);
        // Error sending message
        // Message will be restored via the error state
        // ensure ChatInput keeps its current contents if error occurs – let the
        // component manage it locally.
      }

      // reset any pre-filled prompt after successful send
      setPrefillMessage(null);
    },
    [
      sendMessage,
      selectedModel,
      initialThreadId,
      isAnonymous,
      anonSessionId,
      threadId,
      threadMeta,
      updateThreadMutation,
    ],
  );

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
      if (!isLoading && threadId && effectiveMessages.length > 0) {
        // Find the latest assistant message that isn't cached yet
        const lastMessage = effectiveMessages[effectiveMessages.length - 1];

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
                  messageId:
                    (lastMessage as { _id?: string })._id ||
                    `assistant-${Date.now()}`,
                },
                sessionId: isAnonymous ? anonSessionId : undefined,
              }),
            });
            // Cached assistant message via API

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
                // Auto-updated thread title from AI response
              } catch {
                // Failed to auto-update thread title from AI response
              }
            }
          } catch {
            // Failed to cache assistant message
          }
        }

        // Attachments are now handled via experimental_attachments in AI SDK
      }
    };

    // Only cache when streaming is complete
    if (!isLoading) {
      cacheAssistantMessages();
    }
  }, [
    isLoading,
    effectiveMessages,
    threadId,
    selectedModel,
    isAnonymous,
    anonSessionId,
    threadMeta,
    updateThreadMutation,
  ]);

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
          <ChatMessages
            messages={displayMessages}
            isLoading={isLoading}
            isBrowsing={isBrowsing}
          />
        ) : (
          <ChatWelcomeScreen
            mounted={mounted}
            isLoaded={!!user}
            isAnonymous={isAnonymous}
            remainingMessages={remainingMessages}
            canSendMessage={canSendMessage}
            isLoading={isLoading}
            floatingColors={floatingColors}
            getUserGreeting={getUserGreeting}
            getUserSubtext={getUserSubtext}
            handleQuickPrompt={handleQuickPrompt}
          />
        )}
      </div>

      {/* Fixed Chat Input at Bottom */}
      <div className="flex-shrink-0">
        <ChatInput
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          presetMessage={prefillMessage}
          onSend={handleSend}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
});

export { ChatArea };
