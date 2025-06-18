"use client";

import { useHotkeyContext } from "@/lib/contexts/hotkey-context";
import { ChatSearchDialog } from "./chat-search-dialog";

/**
 * Global chat search dialog that can be triggered by hotkeys
 * This component should be placed at the root level to be accessible from anywhere
 */
export function GlobalChatSearch() {
  const { isSearchDialogOpen, closeSearchDialog } = useHotkeyContext();

  return (
    <ChatSearchDialog
      open={isSearchDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeSearchDialog();
        }
      }}
    />
  );
}
