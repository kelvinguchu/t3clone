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

  // Handle thread deletion: if we're on a specific thread but it returns null,
  // it means the thread was deleted, so redirect to main chat page
  useEffect(() => {
    if (
      initialThreadId && // We're on a specific thread page
      historicalQueryArgs !== "skip" && // Query should be running
      historicalMessages === null // Thread not found (deleted)
    ) {
      console.log("[ChatArea] Thread deleted, redirecting to main chat page");
      router.push("/chat");
      return; // Early return to prevent further processing
    }
  }, [initialThreadId, historicalQueryArgs, historicalMessages, router]);

  // FIXED: Stabilize initial messages to prevent cascading re-renders
  const initialMessages = useMemo(() => {
    // Handle null case (thread deleted) by returning undefined
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

  // Memoize the onError callback to prevent useChat from recreating
  const onChatError = useCallback((error: Error) => {
    console.error("[ChatArea] CHAT_ERROR - Error in chat:", error);
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

  // FIXED: Use stable message references to prevent infinite re-renders
  const stableMessages = useStableMessages(hookMessages);

  // Mutation to remove last assistant message from database
  const removeLastAssistantMessage = useMutation(
    api.messages.removeLastAssistantMessage,
  );

  // Create a retry function that handles reasoning models specially
  const handleRetryWithCleanup = useCallback(async (): Promise<
    string | null | undefined
  > => {
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
    // Return undefined to match the expected signature
    return undefined;
  }, [
    threadId,
    status,
    stableMessages, // Changed from hookMessages to stableMessages
    selectedModel,
    data,
    removeLastAssistantMessage,
    isAnonymous,
    anonSessionId,
    setMessages,
    reload,
    sendMessage,
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

  // AI SDK Pattern: Use AI SDK messages for all UI display
  // Convex is only used for persistence and loading initial messages
  const effectiveMessages = useEffectiveMessages(stableMessages); // Use stable messages

  // OPTIMIZED: Use AI SDK status for immediate loading feedback
  const isLoading = useLoadingState(status, hookLoading, effectiveMessages);

  // Detect web-browsing phase: when a generation is in-progress, the last assistant
  // message exists but is still empty (Gemini/LLM has not emitted any tokens yet).
  // This happens while the model is busy executing tool calls (e.g. Browserbase).
  const lastAssistantMessage = useLastAssistantMessage(effectiveMessages);

  // Track whether the current generation was started with web-browsing enabled.
  const [pendingBrowsing, setPendingBrowsing] =
    usePendingBrowsingState(isLoading);

  // Track whether the current generation was started with a thinking model.
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

  // Get detailed thinking phase information
  const { isThinkingPhase, shouldShowThinkingDisplay, hasStartedResponding } =
    useThinkingPhase(isLoading, lastAssistantMessage, pendingThinking);

  // Get current loading status text (only show "Thinking..." if in pure thinking phase and no thinking display)
  const loadingStatusText = useLoadingStatusText(
    isLoading,
    isThinking && !shouldShowThinkingDisplay, // Only show thinking text if we don't have the display
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

  // Handle thread deletion for threadMeta query as well
  useEffect(() => {
    if (
      initialThreadId && // We're on a specific thread page
      threadMetaQueryArgs !== "skip" && // Query should be running
      threadMeta === null // Thread not found (deleted)
    ) {
      console.log(
        "[ChatArea] Thread metadata not found (deleted), redirecting to main chat page",
      );
      router.push("/chat");
      return; // Early return to prevent further processing
    }
  }, [initialThreadId, threadMetaQueryArgs, threadMeta, router]);

  // FIXED: Stabilize model change effect to prevent cascading updates
  // Only auto-change model when thread first loads, not when user manually changes it
  const currentModelFromThread = threadMeta?.model;
  const hasLoadedThreadModel = useRef(false);

  useEffect(() => {
    // Only auto-set model from thread on initial load, not on subsequent user changes
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

  // FIXED: Stable display messages conversion to prevent unnecessary recalculations
  const displayMessages: DisplayMessage[] = useMemo(() => {
    return convertToDisplayMessages(
      effectiveMessages,
      selectedModel,
      // Handle null case by passing undefined to the converter
      historicalMessages === null ? undefined : historicalMessages,
    );
  }, [effectiveMessages, selectedModel, historicalMessages]);

  const hasMessages = displayMessages.length > 0;

  // Memoize mounted state to prevent unnecessary re-renders
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Memoize user display functions using extracted functions
  const getUserGreetingMemo = useCallback(
    () =>
      getUserGreeting({
        user,
        mounted,
        isAnonymous,
        remainingMessages,
        canSendMessage,
      }),
    [user, mounted, isAnonymous, remainingMessages, canSendMessage],
  );

  const getUserSubtextMemo = useCallback(
    () =>
      getUserSubtext({
        user,
        mounted,
        isAnonymous,
        canSendMessage,
        remainingMessages,
      }),
    [user, mounted, isAnonymous, canSendMessage, remainingMessages],
  );

  // Quick-prompt handling – we just forward the preset down to ChatInput so
  // that the heavy ChatArea component does not re-render on every keystroke.
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
    ],
  );

  const modelInfo = getModelInfo(selectedModel);

  // Use extracted model theme functions
  const modelThemeClasses = useMemo(
    () => getModelThemeClasses(modelInfo),
    [modelInfo],
  );
  const floatingColors = useMemo(
    () => getFloatingElementColors(modelInfo),
    [modelInfo],
  );

  const { messagesContainerRef, showScrollButton, scrollToBottom } =
    useScrollManager({ displayMessages, isLoading });

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

  return (
    <div
      className={`flex-1 flex flex-col h-full min-h-0 bg-purple-50 dark:bg-dark-bg duration-1000 transition-all ${modelThemeClasses} relative ${
        sidebarOpen
          ? "md:border-2 md:border-r-purple-200 md:border-l-purple-200 md:dark:border-l-dark-purple-accent md:border-t-purple-200 md:rounded-t-[1rem] md:dark:border-t-dark-purple-accent"
          : "md:border-2 md:border-t-transparent md:border-l-transparent md:border-r-transparent md:rounded-t-[0]"
      }`}
    >
      {/* Scrollable Messages Area - Account for fixed mobile header */}
      <div
        className="flex-1 overflow-y-auto min-h-0 pt-12 md:pt-0"
        style={{ paddingBottom: `${Math.max(inputHeight * 0.2, 8)}px` }}
        ref={messagesContainerRef}
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
            mounted={mounted}
            isLoaded={!!user}
            isAnonymous={isAnonymous}
            remainingMessages={remainingMessages}
            canSendMessage={canSendMessage}
            isLoading={isLoading}
            floatingColors={floatingColors}
            getUserGreeting={getUserGreetingMemo}
            getUserSubtext={getUserSubtextMemo}
            handleQuickPrompt={handleQuickPrompt}
          />
        )}
      </div>

      {/* Error Display */}
      {chatError && (
        <div className="flex-shrink-0 px-4 pb-2">
          <ErrorDisplay
            error={chatError}
            onRetry={() => {
              setChatError(null);
              handleRetryWithCleanup();
            }}
            onDismiss={() => setChatError(null)}
            retryable={true}
          />
        </div>
      )}

      {/* Fixed Chat Input at Bottom - Account for mobile positioning */}
      <div className="flex-shrink-0 pb-safe">
        <ChatInput
          presetMessage={prefillMessage}
          onSend={handleSend}
          sessionData={{
            isAnonymous,
            canSendMessage,
            remainingMessages,
            messageCount,
          }}
          onHeightChange={setInputHeight}
          onStop={stop}
          status={status}
          isSavingPartial={isSavingPartial}
        />
      </div>

      {/* Scroll-to-bottom button - Positioned to center within chat input area */}
      <div
        className={`fixed left-0 right-0 md:absolute md:left-0 md:right-0 z-55 transition-all duration-300 ${
          showScrollButton
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2 pointer-events-none"
        }`}
        style={{
          // Responsive spacing: closer on mobile (8px), more space on desktop (12px)
          bottom: `${inputHeight + (isMobile ? 8 : 12)}px`,
        }}
      >
        <div className="flex justify-center">
          <LiquidGlassButton
            onClick={scrollToBottom}
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
