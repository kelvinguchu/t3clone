"use client";

import { ChatArea } from "./chat-area";

interface ChatContainerProps {
  initialThreadId?: string | null;
}

export function ChatContainer({ initialThreadId = null }: ChatContainerProps) {
  return <ChatArea initialThreadId={initialThreadId} />;
}
