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

// Check if message contains keywords that should trigger web browsing
function shouldEnableWebBrowsing(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return WEB_BROWSING_KEYWORDS.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase()),
  );
}

export { WEB_BROWSING_KEYWORDS, shouldEnableWebBrowsing };

// Manage input state including model, message, attachments, and web browsing
export function useInputStateManager({
  presetMessage,
  onHeightChange,
}: InputStateManagerParams): InputStateManagerReturn {
  const pathname = usePathname();

  const { selectedModel, setSelectedModel, _hasHydrated } = useModelStore();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [enableWebBrowsing, setEnableWebBrowsing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [userManuallyDisabled, setUserManuallyDisabled] = useState(false);
  const [message, setMessage] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

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

  // Generate thread key from pathname for state management
  const currentThreadKey = useMemo(() => {
    if (pathname === "/chat") {
      return "new-chat";
    }
    if (pathname?.startsWith("/chat/")) {
      const threadId = pathname.split("/")[2];
      return `thread-${threadId}`;
    }
    return "new-chat";
  }, [pathname]);

  // Reset manual disable flag on thread change
  useEffect(() => {
    setUserManuallyDisabled(false);
  }, [currentThreadKey]);

  // Initialize web browsing state from localStorage after mount
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("enableWebBrowsing");
      const initialState = saved === "true";
      setEnableWebBrowsing(initialState);
    }
  }, []);

  // Persist web browsing state to localStorage
  useEffect(() => {
    if (isMounted && typeof window !== "undefined") {
      localStorage.setItem("enableWebBrowsing", enableWebBrowsing.toString());
    }
  }, [enableWebBrowsing, isMounted]);

  // Auto-resize textarea and report height changes
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    const container = inputContainerRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = `${newHeight}px`;

      if (container && onHeightChange) {
        const containerHeight = container.offsetHeight;
        onHeightChange(containerHeight);
      }
    }
  }, [onHeightChange]);

  // Update message when preset is provided
  useEffect(() => {
    if (presetMessage) {
      setMessage(presetMessage);
      setTimeout(autoResize, 0);
    }
  }, [presetMessage, autoResize]);

  useEffect(() => {
    autoResize();
  }, [message, autoResize]);

  // Track manual web browsing changes to prevent auto-enabling
  const handleWebBrowsingChange = useCallback((enabled: boolean) => {
    setEnableWebBrowsing(enabled);

    if (!enabled) {
      setUserManuallyDisabled(true);
    } else {
      setUserManuallyDisabled(false);
    }
  }, []);

  // Auto-enable web browsing based on message keywords
  useEffect(() => {
    if (
      isMounted &&
      message.trim() &&
      !enableWebBrowsing &&
      !userManuallyDisabled
    ) {
      if (shouldEnableWebBrowsing(message)) {
        setEnableWebBrowsing(true);
      }
    }
  }, [message, enableWebBrowsing, isMounted, userManuallyDisabled]);

  useEffect(() => {
    autoResize();
  }, [autoResize]);

  return {
    selectedModel,
    setSelectedModel,
    _hasHydrated,
    message,
    setMessage,
    placeholderIndex,
    setPlaceholderIndex,
    placeholderTexts,
    attachmentIds,
    setAttachmentIds,
    enableWebBrowsing,
    setEnableWebBrowsing: handleWebBrowsingChange,
    isMounted,
    textareaRef,
    inputContainerRef,
    autoResize,
    currentThreadKey,
  };
}

// Manage placeholder text cycling animation
export function usePlaceholderAnimation(
  placeholderTexts: string[],
  message: string,
  attachmentCount: number,
  setPlaceholderIndex: React.Dispatch<React.SetStateAction<number>>,
): void {
  // Cycle placeholder only when input is empty
  useEffect(() => {
    if (message.trim() || attachmentCount > 0) {
      return;
    }

    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [placeholderTexts.length, message, attachmentCount, setPlaceholderIndex]);
}
