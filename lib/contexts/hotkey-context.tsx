"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { useHotkey } from "@/hooks/use-hotkeys";
import {
  useThreadCreator,
  useNewChatHandler,
} from "@/lib/actions/chat/chat-sidebar";
import { useThreadsCache } from "./threads-cache-context";

interface HotkeyContextType {
  openSearchDialog: () => void;
  closeSearchDialog: () => void;
  isSearchDialogOpen: boolean;
  createNewChat: () => void;
}

const HotkeyContext = createContext<HotkeyContextType | undefined>(undefined);

export function useHotkeyContext() {
  const context = useContext(HotkeyContext);
  if (context === undefined) {
    throw new Error("useHotkeyContext must be used within a HotkeyProvider");
  }
  return context;
}

interface HotkeyProviderProps {
  children: ReactNode;
}

export function HotkeyProvider({ children }: HotkeyProviderProps) {
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const { user } = useUser();
  const { invalidateCache } = useThreadsCache();

  const openSearchDialog = () => setIsSearchDialogOpen(true);
  const closeSearchDialog = () => setIsSearchDialogOpen(false);

  // Get new chat handler functionality
  const threadCreator = useThreadCreator(user);
  const handleNewChat = useNewChatHandler({
    user,
    threadCreator,
    onNewThread: () => {
      // Invalidate cache so sidebar updates immediately when using the hotkey
      invalidateCache();
    },
  });

  const createNewChat = () => {
    handleNewChat();
  };

  // Register global hotkeys
  useHotkey(
    "k",
    openSearchDialog,
    { ctrl: true, meta: true }, // Ctrl+K or Cmd+K
    {
      enabled: !isSearchDialogOpen, // Disable when dialog is already open
      preventDefault: true, // Prevent browser's default Ctrl+K behavior
      stopPropagation: true, // Stop event from bubbling
    },
  );

  useHotkey(
    "o",
    createNewChat,
    { ctrl: true, meta: true, shift: true },
    {
      preventDefault: true,
      stopPropagation: true,
    },
  );

  useHotkey("Escape", closeSearchDialog, {}, { enabled: isSearchDialogOpen });

  const value: HotkeyContextType = {
    openSearchDialog,
    closeSearchDialog,
    isSearchDialogOpen,
    createNewChat,
  };

  return (
    <HotkeyContext.Provider value={value}>{children}</HotkeyContext.Provider>
  );
}
