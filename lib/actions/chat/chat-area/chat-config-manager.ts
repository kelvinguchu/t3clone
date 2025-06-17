import { useMemo } from "react";
import type { Message } from "ai";
import type { ModelId } from "@/lib/ai-providers";
import type { UseChatHelpers } from "@ai-sdk/react";

/**
 * Configuration for useChat hook
 */
export interface UseChatConfig {
  modelId: ModelId;
  initialThreadId: string | null;
  initialMessages: Message[] | undefined;
  onError: (error: Error) => void;
  experimental_throttle: number;
  sendExtraMessageFields: boolean;
}

/**
 * Configuration for useAutoResume hook
 */
export interface AutoResumeConfig {
  autoResume: boolean;
  initialMessages: Message[];
  experimental_resume: UseChatHelpers["experimental_resume"];
  data: UseChatHelpers["data"];
  setMessages: UseChatHelpers["setMessages"];
}

/**
 * Custom hook that creates memoized useChat configuration to prevent hook re-initialization
 * @param selectedModel - Currently selected AI model
 * @param initialThreadId - Thread ID for the conversation
 * @param initialMessages - Initial messages for the chat
 * @param onChatError - Error callback function
 * @returns Memoized useChat configuration object
 */
export function useUseChatConfig(
  selectedModel: ModelId,
  initialThreadId: string | null,
  initialMessages: Message[] | undefined,
  onChatError: (error: Error) => void,
): UseChatConfig {
  return useMemo(
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
}

/**
 * Custom hook that creates memoized useAutoResume configuration
 * @param initialMessages - Initial messages for auto-resume
 * @param experimental_resume - Resume function from useChat
 * @param data - Data from useChat hook
 * @param setMessages - Message setter function
 * @returns Memoized autoResume configuration object
 */
export function useAutoResumeConfig(
  initialMessages: Message[] | undefined,
  experimental_resume: UseChatHelpers["experimental_resume"],
  data: UseChatHelpers["data"],
  setMessages: UseChatHelpers["setMessages"],
): AutoResumeConfig {
  return useMemo(
    () => ({
      autoResume: true,
      initialMessages: initialMessages || [],
      experimental_resume,
      data,
      setMessages,
    }),
    [initialMessages, experimental_resume, data, setMessages],
  );
}
