"use client";

import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useUser } from "@clerk/nextjs";
import { ChatInput } from "./chat-input";
import { ChatWelcomeScreen } from "./chat-welcome-screen";
import { ChatMessages } from "./chat-messages";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";
import { useChat } from "@/lib/hooks/use-chat";
import type { Id } from "@/convex/_generated/dataModel";
import { getModelInfo, type ModelId } from "@/lib/ai-providers";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { generateThreadTitle, shouldUpdateTitle } from "@/lib/title-generator";
import type { Message } from "@ai-sdk/react";
import { useAutoResume } from "@/lib/hooks/use-auto-resume";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";

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
  // Tool usage tracking from database
  toolsUsed?: string[];
  hasToolCalls?: boolean;
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

const ChatArea = memo(
  function ChatArea({
    initialThreadId = null,
    selectedModel,
    onModelChange,
  }: Readonly<ChatAreaProps>) {
    console.log("[ChatArea] RENDER - Component rendered", {
      initialThreadId,
      selectedModel,
      onModelChangeRef: onModelChange.toString().substring(0, 50),
      timestamp: new Date().toISOString(),
    });

    const router = useRouter();
    const { user } = useUser();

    // Single call to useAnonymousSession to prevent duplicate subscriptions
    const {
      sessionId: anonSessionId,
      isAnonymous,
      canSendMessage,
      remainingMessages,
      messageCount,
    } = useAnonymousSession();

    // Debug: Track what's changing in anonymous session
    console.log("[ChatArea] ANONYMOUS_SESSION - Session data:", {
      anonSessionId,
      isAnonymous,
      canSendMessage,
      remainingMessages,
      messageCount,
    });

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

    const [initialMessages, setInitialMessages] = useState<
      Message[] | undefined
    >(undefined);

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

    // Memoize useChat configuration to prevent hook re-initialization
    const useChatConfig = useMemo(
      () => ({
        modelId: selectedModel,
        initialThreadId,
        initialMessages,
        onError: onChatError,
        // Throttle UI updates to improve performance
        experimental_throttle: 50,
        // Send only essential message fields to reduce payload
        sendExtraMessageFields: false,
      }),
      [selectedModel, initialThreadId, initialMessages, onChatError],
    );

    console.log("[ChatArea] USECHAT_CONFIG - Configuration:", {
      modelId: useChatConfig.modelId,
      initialThreadId: useChatConfig.initialThreadId,
      hasInitialMessages: !!useChatConfig.initialMessages,
      initialMessagesLength: useChatConfig.initialMessages?.length || 0,
      hasOnError: !!useChatConfig.onError,
    });

    // Use the chat hook for both sending messages and getting real-time streaming
    const {
      sendMessage,
      threadId,
      messages: hookMessages,
      isLoading: hookLoading,
      status,
      experimental_resume,
      data,
      setMessages,
      reload, // AI SDK reload function for retry functionality
    } = useChat(useChatConfig);

    // Memoize useAutoResume configuration
    const autoResumeConfig = useMemo(
      () => ({
        autoResume: true,
        initialMessages: initialMessages || [],
        experimental_resume,
        data,
        setMessages,
      }),
      [initialMessages, experimental_resume, data, setMessages],
    );

    // Add resumable stream support
    useAutoResume(autoResumeConfig);

    // AI SDK Pattern: Use AI SDK messages for all UI display
    // Convex is only used for persistence and loading initial messages
    const effectiveMessages = useMemo(() => {
      // Always use AI SDK messages for display - they handle streaming perfectly
      // The initial messages from Convex are loaded into the AI SDK via initialMessages
      return hookMessages;
    }, [hookMessages]);

    // OPTIMIZED: Use AI SDK status for immediate loading feedback
    const isLoading = useMemo(() => {
      // Immediate feedback based on AI SDK status
      if (status === "submitted" || status === "streaming") return true;

      // Fallback: Check if AI SDK is processing the request
      if (hookLoading) return true;

      // Check if any message in Convex is marked as streaming
      return effectiveMessages.some(
        (m) => (m as { isStreaming?: boolean }).isStreaming,
      );
    }, [status, hookLoading, effectiveMessages]);

    // Enhanced status detection for different loading phases
    const loadingPhase = useMemo(() => {
      if (status === "submitted") return "generating"; // AI is processing
      if (status === "streaming") return "generating"; // AI is responding
      if (status === "error") return "error"; // Error occurred
      return "ready"; // Ready for new input
    }, [status]);

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

    // Track whether the current generation was started with web-browsing enabled.
    const [pendingBrowsing, setPendingBrowsing] = useState(false);

    const isBrowsing = useMemo(() => {
      if (!pendingBrowsing || !isLoading || !lastAssistantMessage) return false;
      return (lastAssistantMessage.content ?? "").trim().length === 0;
    }, [pendingBrowsing, isLoading, lastAssistantMessage]);

    // Get current loading status text
    const loadingStatusText = useMemo(() => {
      if (!isLoading) return null;
      if (isBrowsing) return "Browsing...";
      return "Generating...";
    }, [isLoading, isBrowsing]);

    // Reset browsing flag once generation completes
    useEffect(() => {
      if (!isLoading) setPendingBrowsing(false);
    }, [isLoading]);

    console.log("[ChatArea] MESSAGES_STATE - Current messages state", {
      messagesCount: effectiveMessages.length,
      isLoading,
      status,
      loadingPhase,
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

    // Convert AI SDK messages to display format
    const displayMessages: DisplayMessage[] = useMemo(() => {
      return effectiveMessages.map((m) => {
        // Check if this message exists in historical data (has database info)
        const historicalMessage = historicalMessages?.find(
          (hm) => hm._id === m.id,
        );

        return {
          role: m.role as DisplayMessage["role"],
          content: m.content,
          id: m.id,
          // Use model from database if available, otherwise use current selected model for new messages
          model:
            historicalMessage?.model ||
            (m.role === "assistant" ? selectedModel : undefined),
          // Tool usage data from database (only available for historical messages)
          toolsUsed: historicalMessage?.toolsUsed,
          hasToolCalls: historicalMessage?.hasToolCalls,
          attachments:
            m.experimental_attachments?.map((att) => ({
              id: att.url, // Use URL as ID for experimental attachments
              name: att.name || "Attachment",
              contentType: att.contentType || "application/octet-stream",
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
        };
      });
    }, [effectiveMessages, selectedModel, historicalMessages]);

    console.log(
      "[ChatArea] DISPLAY_MESSAGES - Processed messages for display",
      {
        displayCount: displayMessages.length,
        messagesWithAttachments: displayMessages.filter(
          (m) => m.attachments && m.attachments.length > 0,
        ).length,
        messagesWithToolCalls: displayMessages.filter((m) => m.hasToolCalls)
          .length,
        toolUsageDetails: displayMessages
          .filter((m) => m.hasToolCalls)
          .map((m) => ({
            messageId: m.id,
            model: m.model,
            toolsUsed: m.toolsUsed,
            hasToolCalls: m.hasToolCalls,
          })),
        attachmentDetails: displayMessages
          .filter((m) => m.attachments && m.attachments.length > 0)
          .map((m) => ({
            messageId: m.id,
            attachmentCount: m.attachments?.length || 0,
            attachmentTypes: m.attachments?.map((a) => a.contentType) || [],
          })),
      },
    );

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

    // Remove last assistant message mutation for retry functionality
    const removeLastAssistantMessageMutation = useMutation(
      api.messages.removeLastAssistantMessage,
    );

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
        console.log(
          "[ChatArea] WEB_BROWSING_RECEIVED - handleSend called with web browsing option:",
          {
            userMessage: message.substring(0, 50) + "...",
            enableWebBrowsing: options?.enableWebBrowsing,
            optionsObject: options,
            hasAttachments: !!(attachmentIds && attachmentIds.length > 0),
            timestamp: new Date().toISOString(),
          },
        );

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

        try {
          console.log(
            "[ChatArea] HANDLE_SEND - Calling sendMessage with experimental_attachments",
          );

          // Convert attachment previews to experimental_attachments format for AI SDK
          const experimentalAttachments = attachmentPreviews?.map(
            (preview) => ({
              name: preview.name,
              contentType: preview.contentType,
              url: preview.url,
            }),
          );

          console.log(
            "[ChatArea] HANDLE_SEND - Experimental attachments:",
            experimentalAttachments,
          );

          console.log(
            "[ChatArea] WEB_BROWSING_FORWARD - About to call sendMessage with web browsing:",
            {
              message: message.substring(0, 50) + "...",
              enableWebBrowsing: options?.enableWebBrowsing,
              sendMessageOptions: {
                experimental_attachments: experimentalAttachments,
                enableWebBrowsing: options?.enableWebBrowsing,
              },
            },
          );

          // Use AI SDK's sendMessage for optimistic updates and proper streaming
          sendMessage(message, attachmentIds, {
            experimental_attachments: experimentalAttachments,
            enableWebBrowsing: options?.enableWebBrowsing,
          });

          console.log(
            "[ChatArea] WEB_BROWSING_CALLED - sendMessage called with enableWebBrowsing:",
            options?.enableWebBrowsing,
          );

          console.log(
            "[ChatArea] HANDLE_SEND - sendMessage completed successfully",
          );

          // Store browsing flag for UI indicator
          setPendingBrowsing(!!options?.enableWebBrowsing);

          // Cache user message in background (non-blocking)
          if (initialThreadId) {
            console.log(
              "[ChatArea] HANDLE_SEND - Caching user message in background for thread:",
              initialThreadId,
            );
            // Don't await - cache in background to avoid blocking UI
            fetch("/api/cache/messages", {
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
            }).catch((error) => {
              console.error(
                "[ChatArea] HANDLE_SEND - Error caching user message (non-blocking):",
                error,
              );
            });
          }

          // Auto-update thread title if it's still "New Chat" (background operation)
          if (threadId && threadMeta && shouldUpdateTitle(threadMeta.title)) {
            console.log("[ChatArea] Auto-updating thread title in background");
            // Don't await - update title in background
            generateThreadTitle(message)
              .then((newTitle) => {
                return updateThreadMutation({
                  threadId: threadId as Id<"threads">,
                  title: newTitle,
                  ...(isAnonymous && anonSessionId
                    ? { sessionId: anonSessionId }
                    : {}),
                });
              })
              .then(() => {
                console.log("[ChatArea] Thread title updated successfully");
              })
              .catch((error) => {
                console.error(
                  "[ChatArea] Failed to auto-update thread title (non-blocking):",
                  error,
                );
              });
          }
        } catch (error) {
          console.error(
            "[ChatArea] HANDLE_SEND - Error sending message:",
            error,
          );
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

    // Enhanced reload function that also cleans up database
    const handleRetryWithCleanup = useCallback(async (): Promise<
      string | undefined
    > => {
      if (!reload || !initialThreadId) return undefined;

      try {
        // First, remove the last assistant message from the database
        await removeLastAssistantMessageMutation({
          threadId: initialThreadId as Id<"threads">,
          ...(isAnonymous && anonSessionId ? { sessionId: anonSessionId } : {}),
        });

        // Then use AI SDK's reload to retry the generation
        return (await reload()) || undefined;
      } catch (error) {
        console.error("Failed to retry with cleanup:", error);
        // Fallback to just AI SDK reload if database cleanup fails
        try {
          return (await reload()) || undefined;
        } catch (reloadError) {
          console.error("Failed to reload:", reloadError);
          return undefined;
        }
      }
    }, [
      reload,
      initialThreadId,
      removeLastAssistantMessageMutation,
      isAnonymous,
      anonSessionId,
    ]);

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

    // Track whether user is near the bottom of the message list
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [isSmoothScrolling, setIsSmoothScrolling] = useState(false);

    // Show scroll-to-bottom button when user is not at bottom (but hide during smooth scroll to prevent flicker)
    const showScrollButton = !isAtBottom && !isSmoothScrolling;

    const scrollToBottom = useCallback(() => {
      const el = messagesContainerRef.current;
      if (!el) return;

      // Set smooth scrolling state to prevent button flicker during animation
      setIsSmoothScrolling(true);

      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });

      // Clear smooth scrolling state after animation completes
      setTimeout(() => {
        setIsSmoothScrolling(false);
      }, 500); // Smooth scroll typically takes ~300-500ms
    }, []);

    // Attach scroll listener to toggle button visibility
    useEffect(() => {
      const el = messagesContainerRef.current;
      if (!el) return;

      let scrollTimeout: NodeJS.Timeout;

      const handleScroll = () => {
        const { scrollTop, clientHeight, scrollHeight } = el;
        // Increase threshold to prevent flickering near bottom
        const atBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold

        // Debounce scroll detection to prevent rapid state changes
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          setIsAtBottom(atBottom);
          // Don't modify isSmoothScrolling here - let it be controlled by scrollToBottom function
        }, 50);
      };

      el.addEventListener("scroll", handleScroll);
      handleScroll(); // initialise

      return () => {
        el.removeEventListener("scroll", handleScroll);
        clearTimeout(scrollTimeout);
      };
    }, []);

    // Auto-scroll only if user is already at the bottom
    useEffect(() => {
      if (!isAtBottom) return;
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, [displayMessages, isAtBottom]);

    // During streaming keep auto-scroll if user is at bottom
    useEffect(() => {
      if (!(isLoading && isAtBottom) || !messagesContainerRef.current) return;
      const interval = setInterval(() => scrollToBottom(), 120);
      return () => clearInterval(interval);
    }, [isLoading, isAtBottom, scrollToBottom]);

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
                  const newTitle = await generateThreadTitle(
                    lastMessage.content,
                  );
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
        className={`flex-1 flex flex-col h-full min-h-0 rounded-tl-[1rem] bg-gradient-to-br transition-all duration-1000 border-2 border-l-purple-200 dark:border-t-purple-800 border-t-purple-200 dark:border-l-purple-800 ${getModelThemeClasses()} relative`}
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
              loadingStatusText={loadingStatusText}
              threadId={initialThreadId}
              reload={handleRetryWithCleanup} // Pass enhanced retry with database cleanup
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
          <div className="min-h-[140px] flex flex-col justify-end">
            <ChatInput
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              presetMessage={prefillMessage}
              onSend={handleSend}
              isLoading={isLoading}
              sessionData={{
                isAnonymous,
                canSendMessage,
                remainingMessages,
                messageCount,
              }}
            />
          </div>
        </div>

        {/* Scroll-to-bottom button - TRUE overlay positioned relative to entire ChatArea */}
        <div
          className={`absolute bottom-[160px] left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${
            showScrollButton
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          <LiquidGlassButton
            onClick={scrollToBottom}
            transparency={10}
            noise={50}
          >
            Scroll to bottom
          </LiquidGlassButton>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memo to prevent unnecessary re-renders
    const propsEqual =
      prevProps.initialThreadId === nextProps.initialThreadId &&
      prevProps.selectedModel === nextProps.selectedModel &&
      prevProps.onModelChange === nextProps.onModelChange;

    if (!propsEqual) {
      console.log("[ChatArea] MEMO_COMPARISON - Props changed, re-rendering:", {
        initialThreadIdChanged:
          prevProps.initialThreadId !== nextProps.initialThreadId,
        selectedModelChanged:
          prevProps.selectedModel !== nextProps.selectedModel,
        onModelChangeChanged:
          prevProps.onModelChange !== nextProps.onModelChange,
        prevInitialThreadId: prevProps.initialThreadId,
        nextInitialThreadId: nextProps.initialThreadId,
        prevSelectedModel: prevProps.selectedModel,
        nextSelectedModel: nextProps.selectedModel,
      });
    }

    return propsEqual;
  },
);

export { ChatArea };
