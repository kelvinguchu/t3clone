import { useEffect, useCallback } from "react";

export interface HotkeyOptions {
  preventDefault?: boolean;
  stopPropagation?: boolean;
  enabled?: boolean;
}

export interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  callback: () => void;
  options?: HotkeyOptions;
}

/**
 * Custom hook for handling keyboard shortcuts
 * Supports modifier keys (Ctrl, Meta/Cmd, Shift, Alt)
 *
 * Uses capture phase event handling and multiple prevention techniques
 * to properly override browser shortcuts like Ctrl+K, Ctrl+F, etc.
 */
export function useHotkeys(hotkeys: HotkeyConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger hotkeys when user is typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const hotkey of hotkeys) {
        const {
          key,
          ctrl = false,
          meta = false,
          shift = false,
          alt = false,
          callback,
          options = {},
        } = hotkey;

        const {
          preventDefault = true,
          stopPropagation = true,
          enabled = true,
        } = options;

        if (!enabled) continue;

        // Check if the key matches (case insensitive)
        const keyMatches = event.key.toLowerCase() === key.toLowerCase();

        // Check modifier keys
        const ctrlMatches = ctrl ? event.ctrlKey : !event.ctrlKey;
        const metaMatches = meta ? event.metaKey : !event.metaKey;
        const shiftMatches = shift ? event.shiftKey : !event.shiftKey;
        const altMatches = alt ? event.altKey : !event.altKey;

        // For Ctrl+K, we want either Ctrl or Meta (Cmd on Mac)
        const modifierMatches =
          ctrl || meta
            ? (event.ctrlKey || event.metaKey) && shiftMatches && altMatches
            : ctrlMatches && metaMatches && shiftMatches && altMatches;

        if (keyMatches && modifierMatches) {
          // For browser shortcuts like Ctrl+K, we need to prevent the default behavior
          // This must be done before calling the callback to ensure it's effective
          if (preventDefault) {
            event.preventDefault();
          }
          if (stopPropagation) {
            event.stopPropagation();
          }

          // Additional prevention for stubborn browser shortcuts
          event.returnValue = false;

          callback();
          break; // Only trigger the first matching hotkey
        }
      }
    },
    [hotkeys],
  );

  useEffect(() => {
    // Use capture phase to intercept events before they reach their targets
    // This is crucial for overriding browser shortcuts like Ctrl+K
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handleKeyDown]);
}

/**
 * Simplified hook for a single hotkey
 */
export function useHotkey(
  key: string,
  callback: () => void,
  modifiers: {
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
  } = {},
  options: HotkeyOptions = {},
) {
  const hotkeys: HotkeyConfig[] = [
    {
      key,
      ...modifiers,
      callback,
      options,
    },
  ];

  useHotkeys(hotkeys);
}

/**
 * Common hotkey combinations
 */
export const HOTKEYS = {
  SEARCH: { key: "k", ctrl: true, meta: true }, // Ctrl+K or Cmd+K
  NEW_CHAT: { key: "n", ctrl: true, meta: true }, // Ctrl+N or Cmd+N
  ESCAPE: { key: "Escape" },
  ENTER: { key: "Enter" },
  SAVE: { key: "s", ctrl: true, meta: true }, // Ctrl+S or Cmd+S
} as const;
