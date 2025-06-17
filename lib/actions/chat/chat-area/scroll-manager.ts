import { useCallback, useEffect, useState, useRef } from "react";
import type { DisplayMessage } from "./display-message-converter";

export interface ScrollManagerState {
  isAtBottom: boolean;
  isSmoothScrolling: boolean;
  showScrollButton: boolean;
  scrollToBottom: () => void;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
}

export interface ScrollManagerParams {
  displayMessages: DisplayMessage[];
  isLoading: boolean;
}

// Create scroll manager for chat messages
export function useScrollManager(
  params: ScrollManagerParams,
): ScrollManagerState {
  const { displayMessages, isLoading } = params;

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

  return {
    isAtBottom,
    isSmoothScrolling,
    showScrollButton,
    scrollToBottom,
    messagesContainerRef,
  };
}
