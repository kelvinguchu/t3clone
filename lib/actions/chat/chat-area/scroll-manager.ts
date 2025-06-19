import { useCallback, useEffect, useState, useRef } from "react";

export interface ScrollManagerState {
  isAtBottom: boolean;
  isSmoothScrolling: boolean;
  showScrollButton: boolean;
  scrollToBottom: (behavior?: "smooth" | "auto") => void;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
}

// Create scroll manager for chat messages
export function useScrollManager(): ScrollManagerState {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Track whether user is near the bottom of the message list
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isSmoothScrolling, setIsSmoothScrolling] = useState(false);

  // Show scroll-to-bottom button when user is not at bottom (but hide during smooth scroll to prevent flicker)
  const showScrollButton = !isAtBottom && !isSmoothScrolling;

  const scrollToBottom = useCallback(
    (behavior: "smooth" | "auto" = "smooth") => {
      const el = messagesContainerRef.current;
      if (!el) return;

      if (behavior === "smooth") {
        // Set smooth scrolling state to prevent button flicker during animation
        setIsSmoothScrolling(true);
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        // Clear smooth scrolling state after animation completes
        setTimeout(() => {
          setIsSmoothScrolling(false);
        }, 500); // Smooth scroll typically takes ~300-500ms
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      }
    },
    [],
  );

  // Attach scroll listener to toggle button visibility
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    let scrollTimeout: NodeJS.Timeout;

    const checkScrollPosition = () => {
      const { scrollTop, clientHeight, scrollHeight } = el;
      // Increase threshold to prevent flickering near bottom
      const atBottom = scrollTop + clientHeight >= scrollHeight - 20; // 20px threshold for quicker detection

      // Debounce scroll detection to prevent rapid state changes
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsAtBottom(atBottom);
        // Don't modify isSmoothScrolling here - let it be controlled by scrollToBottom function
      }, 50);
    };

    const handleScroll = () => {
      checkScrollPosition();
    };

    el.addEventListener("scroll", handleScroll);

    // Initial check
    checkScrollPosition();

    // Set up ResizeObserver to detect content changes (new messages streaming in)
    const resizeObserver = new ResizeObserver(() => {
      // When content height changes, immediately check if user is still at bottom
      checkScrollPosition();
    });

    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
      clearTimeout(scrollTimeout);
    };
  }, []);

  return {
    isAtBottom,
    isSmoothScrolling,
    showScrollButton,
    scrollToBottom,
    messagesContainerRef,
  };
}
