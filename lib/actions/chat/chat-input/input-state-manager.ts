import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useModelStore } from "@/lib/stores/model-store";
import type { ModelId } from "@/lib/ai-providers";

export interface InputStateManagerParams {
  presetMessage?: string | null;
  onHeightChange?: (height: number) => void;
}

export interface InputStateManagerReturn {
  // Model state
  selectedModel: ModelId;
  setSelectedModel: (model: ModelId) => void;
  _hasHydrated: boolean;

  // Message state
  message: string;
  setMessage: (message: string) => void;

  // Placeholder state
  placeholderIndex: number;
  setPlaceholderIndex: React.Dispatch<React.SetStateAction<number>>;
  placeholderTexts: string[];

  // Attachment state
  attachmentIds: string[];
  setAttachmentIds: React.Dispatch<React.SetStateAction<string[]>>;

  // Web browsing state
  enableWebBrowsing: boolean;
  setEnableWebBrowsing: (enabled: boolean) => void;

  // Mounting state
  isMounted: boolean;

  // Refs and utilities
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  inputContainerRef: React.RefObject<HTMLDivElement | null>;
  autoResize: () => void;
  currentThreadKey: string;
}

// Keywords that trigger automatic web browsing
const WEB_BROWSING_KEYWORDS = [
  // Search-related
  "search",
  "find",
  "look up",
  "google",
  "bing",
  "duckduckgo",
  "search for",

  // Current/real-time information
  "current",
  "latest",
  "recent",
  "today",
  "now",
  "live",
  "real-time",
  "what's happening",
  "breaking news",
  "updates",
  "up to date",
  "as of",
  "right now",
  "currently",
  "this week",
  "this month",

  // Weather
  "weather",
  "temperature",
  "forecast",
  "climate",
  "rain",
  "snow",
  "degrees",
  "celsius",
  "fahrenheit",

  // News and events
  "news",
  "headlines",
  "events",
  "happening",
  "reported",
  "announced",

  // Stock/financial
  "stock price",
  "market",
  "crypto",
  "bitcoin",
  "trading",
  "exchange rate",
  "currency",
  "nasdaq",
  "dow jones",
  "s&p 500",

  // Sports
  "score",
  "game",
  "match",
  "tournament",
  "league",
  "championship",
  "playoffs",
  "season",
  "standings",

  // Technology
  "release",
  "announcement",
  "launch",
  "version",
  "update",
  "patch",
  "download",
  "available",

  // General web browsing
  "browse",
  "website",
  "url",
  "link",
  "page",
  "site",
  "online",
  "check",
  "verify",
  "confirm",
  "investigate",
  "research",

  // Question words that often need current info
  "what is",
  "what are",
  "who is",
  "where is",
  "when is",
  "how much",
  "what happened",
  "what's new",
];

/**
 * Detect if message contains keywords that should trigger web browsing
 */
function shouldEnableWebBrowsing(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return WEB_BROWSING_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase()),
  );
}

// Export for testing or external use
export { WEB_BROWSING_KEYWORDS, shouldEnableWebBrowsing };

/**
 * Custom hook that manages all input-related state including model selection,
 * message content, placeholders, attachments, and web browsing preferences
 */
export function useInputStateManager({
  presetMessage,
  onHeightChange,
}: InputStateManagerParams): InputStateManagerReturn {
  const pathname = usePathname();

  // Use Zustand store for model selection
  const { selectedModel, setSelectedModel, _hasHydrated } = useModelStore();

  // Placeholder animation state
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Store attachment IDs instead of full attachment objects for better integration with Convex
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);

  // Web browsing toggle state - persist across sessions
  const [enableWebBrowsing, setEnableWebBrowsing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Track if user has manually disabled web browsing to prevent auto-enabling
  const [userManuallyDisabled, setUserManuallyDisabled] = useState(false);

  // Local uncontrolled message state – isolated from parent re-renders
  const [message, setMessage] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  // Memoized placeholder texts
  const placeholderTexts = useMemo(
    () => [
      "Ask me anything...",
      "Start a conversation...",
      "What's on your mind?",
      "Let's explore ideas together...",
      "Type your message here...",
      "Ready to chat?",
    ],
    [],
  );

  // Get current thread ID from pathname
  const currentThreadKey = useMemo(() => {
    if (pathname === "/chat") {
      return "new-chat"; // Special key for the main chat page
    }
    if (pathname?.startsWith("/chat/")) {
      const threadId = pathname.split("/")[2];
      return `thread-${threadId}`;
    }
    return "new-chat"; // Fallback
  }, [pathname]);

  // Reset manual disable flag when thread changes (new conversation)
  useEffect(() => {
    setUserManuallyDisabled(false);
  }, [currentThreadKey]);

  // Initialize web browsing state after component mounts (hydration-safe)
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("enableWebBrowsing");
      const initialState = saved === "true";
      console.log("[InputStateManager] Initializing web browsing state:", {
        savedValue: saved,
        initialState,
        timestamp: new Date().toISOString(),
      });
      setEnableWebBrowsing(initialState);
    }
  }, []);

  // Persist web browsing state to localStorage
  useEffect(() => {
    if (isMounted && typeof window !== "undefined") {
      console.log("[InputStateManager] Persisting web browsing state:", {
        enableWebBrowsing,
        isMounted,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem("enableWebBrowsing", enableWebBrowsing.toString());
    }
  }, [enableWebBrowsing, isMounted]);

  // Auto-resize function
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    const container = inputContainerRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max height of 120px (about 5 lines)
      textarea.style.height = `${newHeight}px`;

      // Report total input container height to parent
      if (container && onHeightChange) {
        // Get the full height of the input container including padding and borders
        const containerHeight = container.offsetHeight;
        onHeightChange(containerHeight);
      }
    }
  }, [onHeightChange]);

  // Keep local state in sync when presetMessage changes (takes priority over draft)
  useEffect(() => {
    if (presetMessage) {
      setMessage(presetMessage);
      // Auto-resize after setting preset message
      setTimeout(autoResize, 0);
    }
  }, [presetMessage, autoResize]);

  // Auto-resize when message changes
  useEffect(() => {
    autoResize();
  }, [message, autoResize]);

  // Create a wrapper function that tracks manual user actions
  const handleWebBrowsingChange = useCallback((enabled: boolean) => {
    setEnableWebBrowsing(enabled);

    // If user manually disables, remember this to prevent auto-enabling
    if (!enabled) {
      setUserManuallyDisabled(true);
      console.log(
        "[InputStateManager] User manually disabled web browsing - preventing auto-enable",
      );
    } else {
      // If user manually enables, reset the flag
      setUserManuallyDisabled(false);
    }
  }, []);

  // Auto-enable web browsing based on keywords in message
  useEffect(() => {
    if (
      isMounted &&
      message.trim() &&
      !enableWebBrowsing &&
      !userManuallyDisabled
    ) {
      if (shouldEnableWebBrowsing(message)) {
        console.log(
          "[InputStateManager] Auto-enabling web browsing due to keywords:",
          {
            message: message.substring(0, 50) + "...",
            timestamp: new Date().toISOString(),
          },
        );
        setEnableWebBrowsing(true);
      }
    } else if (
      isMounted &&
      message.trim() &&
      !enableWebBrowsing &&
      userManuallyDisabled
    ) {
      if (shouldEnableWebBrowsing(message)) {
        console.log(
          "[InputStateManager] Keywords detected but auto-enable prevented - user manually disabled web browsing:",
          {
            message: message.substring(0, 50) + "...",
            userManuallyDisabled,
            timestamp: new Date().toISOString(),
          },
        );
      }
    }
  }, [message, enableWebBrowsing, isMounted, userManuallyDisabled]);

  // Report initial height on mount
  useEffect(() => {
    autoResize();
  }, [autoResize]);

  return {
    // Model state
    selectedModel,
    setSelectedModel,
    _hasHydrated,

    // Message state
    message,
    setMessage,

    // Placeholder state
    placeholderIndex,
    setPlaceholderIndex,
    placeholderTexts,

    // Attachment state
    attachmentIds,
    setAttachmentIds,

    // Web browsing state
    enableWebBrowsing,
    setEnableWebBrowsing: handleWebBrowsingChange,

    // Mounting state
    isMounted,

    // Refs and utilities
    textareaRef,
    inputContainerRef,
    autoResize,
    currentThreadKey,
  };
}

/**
 * Custom hook that manages placeholder animation cycling
 */
export function usePlaceholderAnimation(
  placeholderTexts: string[],
  message: string,
  attachmentCount: number,
  setPlaceholderIndex: React.Dispatch<React.SetStateAction<number>>,
): void {
  // Cycling placeholder animation - only when input is empty
  useEffect(() => {
    // Only animate when input is completely empty and no attachments
    if (message.trim() || attachmentCount > 0) {
      return; // No interval when user has content
    }

    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [placeholderTexts.length, message, attachmentCount, setPlaceholderIndex]);
}
