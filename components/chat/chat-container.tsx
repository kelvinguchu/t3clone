"use client";

import { useState, useCallback } from "react";
import { ChatArea } from "./chat-area";
import type { ModelId } from "@/lib/ai-providers";

interface ChatContainerProps {
  initialThreadId?: string | null;
}

export function ChatContainer({ initialThreadId = null }: ChatContainerProps) {
  const [selectedModel, setSelectedModel] =
    useState<ModelId>("gemini-2.0-flash");

  // Memoize the handleModelChange function to prevent ChatArea re-renders
  const handleModelChange = useCallback((model: ModelId) => {
    console.log("[ChatContainer] Model changed to:", model);
    setSelectedModel(model);
  }, []);

  return (
    <ChatArea
      initialThreadId={initialThreadId}
      selectedModel={selectedModel}
      onModelChange={handleModelChange}
    />
  );
}
