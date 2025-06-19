"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { ChatInput } from "./chat-input";
import { ChatWelcomeScreen } from "./chat-area/chat-welcome-screen";
import { ChatMessages } from "./chat-area/chat-messages";
import { ErrorDisplay } from "./chat-area/error-display";
import { useAnonymousSession } from "@/lib/contexts/anonymous-session-context";
import { useChat } from "@/lib/hooks/use-chat";
import type { Id } from "@/convex/_generated/dataModel";
import { getModelInfo, type ModelId } from "@/lib/ai-providers";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Message } from "@ai-sdk/react";
import { useAutoResume } from "@/lib/hooks/use-auto-resume";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";
import { useSidebar } from "@/components/ui/sidebar";
import { useConversationContextLoader } from "@/lib/actions/chat/chat-area/conversation-context-loader";
import {
  useUseChatConfig,
  useAutoResumeConfig,
} from "@/lib/actions/chat/chat-area/chat-config-manager";
import { useQuickPromptHandler } from "@/lib/actions/chat/chat-area/quick-prompt-handler";
import {
  useEffectiveMessages,
  useLoadingState,
  useLastAssistantMessage,
  useBrowsingState,
  useThinkingState,
  useThinkingPhase,
  useLoadingStatusText,
  usePendingBrowsingState,
  usePendingThinkingState,
} from "@/lib/actions/chat/chat-area/loading-state-manager";
import { convertToDisplayMessages } from "@/lib/actions/chat/chat-area/display-message-converter";
import { handleMessageSend } from "@/lib/actions/chat/chat-area/message-send-handler";
import { handleRetryMessage } from "@/lib/actions/chat/chat-area/retry-message-handler";
import { useScrollManager } from "@/lib/actions/chat/chat-area/scroll-manager";
import { useAssistantMessageCaching } from "@/lib/actions/chat/chat-area/assistant-message-cacher";
import {
  chatAreaMemoComparison,
  type ChatAreaProps,
} from "@/lib/actions/chat/chat-area/memo-comparison";
import {
  getUserGreeting,
  getUserSubtext,
} from "@/lib/actions/chat/chat-area/user-display-info";
import {
  getModelThemeClasses,
  getFloatingElementColors,
} from "@/lib/actions/chat/chat-area/model-theme-manager";
import { useModelStore } from "@/lib/stores/model-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlanLimits } from "@/lib/hooks/use-plan-limits";
import ErrorBoundary from "@/components/error-boundary";

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

/**
 * Stable message comparison function to prevent unnecessary re-renders
 */
function areMessagesEqual(a: Message[], b: Message[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const msgA = a[i];
    const msgB = b[i];

    if (
      msgA.id !== msgB.id ||
      msgA.role !== msgB.role ||
      msgA.content !== msgB.content
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Custom hook for stable message references
 */
function useStableMessages(messages: Message[]): Message[] {
  const stableMessagesRef = useRef<Message[]>([]);

  return useMemo(() => {
    if (!areMessagesEqual(stableMessagesRef.current, messages)) {
      stableMessagesRef.current = messages;
    }

    return stableMessagesRef.current;
  }, [messages]);
}

const ChatArea = memo(function ChatArea({
  initialThreadId = null,
}: Readonly<ChatAreaProps>) {
  const router = useRouter();
  const { user } = useUser();
  const { open: sidebarOpen } = useSidebar();
  const isMobile = useIsMobile();

  // Use Zustand store for model selection
  const { selectedModel, setSelectedModel } = useModelStore();

  // Single call to useAnonymousSession to prevent duplicate subscriptions
  const {
    sessionId: anonSessionId,
    isAnonymous,
    canSendMessage,
    remainingMessages,
    messageCount,
  } = useAnonymousSession();

  // Plan-based rate limiting for authenticated users
  const planLimits = usePlanLimits();

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

  // Redirect to main chat if thread is deleted
  useEffect(() => {
    if (
      initialThreadId &&
      historicalQueryArgs !== "skip" &&
      historicalMessages === null
    ) {
      router.push("/chat");
      return;
    }
  }, [initialThreadId, historicalQueryArgs, historicalMessages, router]);

  // Convert historical messages to AI SDK format
  const initialMessages = useMemo(() => {
    if (historicalMessages === null) return undefined;
    if (!historicalMessages) return undefined;

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
  }, [historicalMessages]);

  // State for error handling
  const [chatError, setChatError] = useState<Error | null>(null);

  // Handle chat errors with stable callback
  const onChatError = useCallback((error: Error) => {
    setChatError(error);
  }, []);

  // Memoize useChat configuration to prevent hook re-initialization
  const useChatConfig = useUseChatConfig(
    selectedModel,
    initialThreadId,
    initialMessages,
    onChatError,
  );

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
    stop, // Stop function from AI SDK with partial save capability
    isSavingPartial, // Partial save state
  } = useChat(useChatConfig);

  // Stabilize message references to prevent re-renders
  const stableMessages = useStableMessages(hookMessages);

  // Mutation to remove last assistant message from database
  const removeLastAssistantMessage = useMutation(
    api.messages.removeLastAssistantMessage,
  );

  // Create a retry function that handles reasoning models specially
  const handleRetryWithCleanup = useCallback(async (): Promise<
    string | null | undefined
  > => {
    try {
      await handleRetryMessage({
        threadId,
        status,
        hookMessages: stableMessages, // Use stable messages
        selectedModel,
        data,
        removeLastAssistantMessage,
        isAnonymous,
        anonSessionId,
        setMessages,
        reload,
        sendMessage,
      });
    } catch (error) {
      onChatError(error as Error);
    }
    // Return undefined to match the expected signature
    return undefined;
  }, [
    threadId,
    status,
    stableMessages,
    selectedModel,
    data,
    removeLastAssistantMessage,
    isAnonymous,
    anonSessionId,
    setMessages,
    reload,
    sendMessage,
    onChatError,
  ]);

  // Memoize useAutoResume configuration
  const autoResumeConfig = useAutoResumeConfig(
    initialMessages,
    experimental_resume,
    data,
    setMessages,
  );

  // Add resumable stream support
  useAutoResume(autoResumeConfig);

  // Use AI SDK messages for UI display, Convex for persistence
  const effectiveMessages = useEffectiveMessages(stableMessages);

  // Track loading state from AI SDK status
  const isLoading = useLoadingState(status, hookLoading, effectiveMessages);

  // Track assistant message states for tool usage detection
  const lastAssistantMessage = useLastAssistantMessage(effectiveMessages);
  const [pendingBrowsing, setPendingBrowsing] =
    usePendingBrowsingState(isLoading);
  const [pendingThinking, setPendingThinking] =
    usePendingThinkingState(isLoading);

  const isBrowsing = useBrowsingState(
    pendingBrowsing,
    isLoading,
    lastAssistantMessage,
  );

  const isThinking = useThinkingState(
    isLoading,
    lastAssistantMessage,
    pendingThinking,
  );

  // Determine thinking and browsing display states
  const { isThinkingPhase, shouldShowThinkingDisplay, hasStartedResponding } =
    useThinkingPhase(isLoading, lastAssistantMessage, pendingThinking);

  const loadingStatusText = useLoadingStatusText(
    isLoading,
    isThinking && !shouldShowThinkingDisplay,
    isBrowsing,
  );

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

  // Handle thread metadata deletion
  useEffect(() => {
    if (
      initialThreadId &&
      threadMetaQueryArgs !== "skip" &&
      threadMeta === null
    ) {
      router.push("/chat");
      return;
    }
  }, [initialThreadId, threadMetaQueryArgs, threadMeta, router]);

  // Auto-set model from thread on initial load only
  const currentModelFromThread = threadMeta?.model;
  const hasLoadedThreadModel = useRef(false);

  useEffect(() => {
    if (
      currentModelFromThread &&
      currentModelFromThread !== selectedModel &&
      !hasLoadedThreadModel.current
    ) {
      hasLoadedThreadModel.current = true;
      setSelectedModel(currentModelFromThread as ModelId);
    }
  }, [currentModelFromThread, selectedModel, setSelectedModel]);

  // Memoize the conversation context loading function
  const loadConversationContext = useConversationContextLoader(initialThreadId);

  // Load and cache conversation context when thread changes
  useEffect(() => {
    if (initialThreadId) {
      loadConversationContext();
    }
  }, [initialThreadId, loadConversationContext]);

  // Convert messages for display with attachments and metadata
  const displayMessages: DisplayMessage[] = useMemo(() => {
    return convertToDisplayMessages(
      effectiveMessages,
      selectedModel,
      historicalMessages === null ? undefined : historicalMessages,
    );
  }, [effectiveMessages, selectedModel, historicalMessages]);

  const hasMessages = displayMessages.length > 0;

  // Stable user display functions for welcome screen
  const getUserGreetingMemo = useCallback(
    () =>
      getUserGreeting({
        user,
        isAnonymous,
        remainingMessages,
        canSendMessage,
      }),
    [user, isAnonymous, remainingMessages, canSendMessage],
  );

  const getUserSubtextMemo = useCallback(
    () =>
      getUserSubtext({
        user,
        isAnonymous,
        canSendMessage,
        remainingMessages,
      }),
    [user, isAnonymous, canSendMessage, remainingMessages],
  );

  // Quick-prompt state for welcome screen interactions
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);

  const handleQuickPrompt = useQuickPromptHandler(
    isAnonymous,
    canSendMessage,
    isLoading,
    setPrefillMessage,
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
      try {
        // Check plan limits for authenticated users
        if (!isAnonymous && !planLimits.canSend) {
          return;
        }

        // Increment usage for authenticated users before sending
        if (!isAnonymous) {
          const incrementSuccess = await planLimits.incrementUsage();
          if (!incrementSuccess) {
            return;
          }
        }

        await handleMessageSend(
          message,
          attachmentIds,
          attachmentPreviews,
          options,
          {
            sendMessage,
            selectedModel,
            initialThreadId,
            isAnonymous,
            anonSessionId,
            threadId,
            threadMeta: threadMeta || null,
            updateThreadMutation,
            setPendingBrowsing,
            setPendingThinking,
            setPrefillMessage,
          },
        );
      } catch (error) {
        onChatError(error as Error);
      }
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
      setPendingBrowsing,
      setPendingThinking,
      setPrefillMessage,
      planLimits,
      onChatError,
    ],
  );

  // Model-specific theming and styling
  const modelInfo = getModelInfo(selectedModel);
  const modelThemeClasses = useMemo(
    () => getModelThemeClasses(modelInfo),
    [modelInfo],
  );
  const floatingColors = useMemo(
    () => getFloatingElementColors(modelInfo),
    [modelInfo],
  );

  const { messagesContainerRef, showScrollButton, scrollToBottom } =
    useScrollManager();

  const initialScrollDone = useRef(false);

  // When historical messages load for the first time, scroll to the bottom.
  useEffect(() => {
    if (historicalMessages && !initialScrollDone.current) {
      scrollToBottom("auto");
      initialScrollDone.current = true;
    }
    // Reset when navigating to a new thread
    if (!initialThreadId) {
      initialScrollDone.current = false;
    }
  }, [historicalMessages, initialThreadId, scrollToBottom]);

  // Track chat input height for dynamic scroll button positioning
  const [inputHeight, setInputHeight] = useState(140);

  // Cache assistant messages when streaming completes
  useAssistantMessageCaching({
    isLoading,
    effectiveMessages,
    threadId,
    selectedModel,
    isAnonymous,
    anonSessionId,
    threadMeta: threadMeta ? { title: threadMeta.title } : null,
    updateThreadMutation,
  });

  // Extract thread-level attachments for model filtering
  const threadAttachments = useMemo(() => {
    if (!historicalMessages) return [];

    const attachments: Array<{
      id: string;
      name: string;
      contentType: string;
      url: string;
      size: number;
    }> = [];

    for (const message of historicalMessages) {
      if (message.attachments) {
        attachments.push(...message.attachments);
      }
    }

    return attachments;
  }, [historicalMessages]);

  return (
    <div
      className={`flex-1 flex flex-col h-full min-h-0 bg-purple-50 dark:bg-dark-bg duration-1000 transition-all ${modelThemeClasses} relative ${
        sidebarOpen
          ? "md:border-2 md:border-r-purple-200 md:border-l-purple-200 md:dark:border-l-dark-purple-accent md:border-t-purple-200 md:rounded-t-[1rem] md:dark:border-t-dark-purple-accent"
          : "md:border-2 md:border-t-transparent md:border-l-transparent md:border-r-transparent md:rounded-t-[0]"
      }`}
    >
      {/* Scrollable Messages Area */}
      <div
        className="flex-1 overflow-y-auto min-h-0 pt-12 md:pt-0 pb-32 md:pb-4"
        ref={messagesContainerRef}
      >
        <ErrorBoundary
          fallbackRender={({ error }) => (
            <div className="p-4">
              <ErrorDisplay
                error={error}
                onRetry={() => {
                  router.refresh();
                }}
                onDismiss={() => {
                  router.refresh();
                }}
                retryable={true}
              />
            </div>
          )}
        >
          {hasMessages ? (
            <ChatMessages
              messages={displayMessages}
              isLoading={isLoading}
              loadingStatusText={loadingStatusText}
              threadId={initialThreadId}
              reload={handleRetryWithCleanup}
              isThinkingPhase={isThinkingPhase}
              shouldShowThinkingDisplay={shouldShowThinkingDisplay}
              hasStartedResponding={hasStartedResponding}
            />
          ) : (
            <ChatWelcomeScreen
              isLoaded={!!user}
              isAnonymous={isAnonymous}
              canSendMessage={canSendMessage}
              isLoading={isLoading}
              floatingColors={floatingColors}
              getUserGreeting={getUserGreetingMemo}
              getUserSubtext={getUserSubtextMemo}
              handleQuickPrompt={handleQuickPrompt}
            />
          )}
        </ErrorBoundary>
      </div>

      {/* Error Display */}
      {chatError && (
        <div className="flex-shrink-0 px-4 pb-2">
          <ErrorDisplay
            error={chatError}
            onRetry={() => {
              setChatError(null);
              reload();
            }}
            onDismiss={() => setChatError(null)}
            retryable={true}
          />
        </div>
      )}

      {/* Fixed Chat Input */}
      <div className="flex-shrink-0 pb-safe">
        <ChatInput
          presetMessage={prefillMessage}
          onSend={handleSend}
          sessionData={{
            isAnonymous,
            canSendMessage: isAnonymous ? canSendMessage : planLimits.canSend,
            remainingMessages: isAnonymous
              ? remainingMessages
              : planLimits.remaining,
            messageCount: isAnonymous ? messageCount : planLimits.used,
          }}
          onHeightChange={setInputHeight}
          onStop={stop}
          status={status}
          isLoaded={!!user}
          isSavingPartial={isSavingPartial}
          threadAttachments={threadAttachments}
        />
      </div>

      {/* Scroll-to-bottom button */}
      <div
        className={`fixed left-0 right-0 md:absolute md:left-0 md:right-0 z-55 transition-all duration-300 ${
          showScrollButton
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
        style={{
          bottom: `${inputHeight + (isMobile ? 8 : 12)}px`,
        }}
      >
        <div className="flex justify-center">
          <LiquidGlassButton
            onClick={() => scrollToBottom()}
            transparency={10}
            noise={50}
            className="dark:shadow-none"
          >
            Scroll to bottom
          </LiquidGlassButton>
        </div>
      </div>
    </div>
  );
}, chatAreaMemoComparison);

export { ChatArea };
