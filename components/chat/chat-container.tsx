"use client";

import { useState } from "react";
import { ChatArea } from "./chat-area";
import type { ModelId } from "@/lib/ai-providers";

interface ChatContainerProps {
  initialThreadId?: string | null;
}

export function ChatContainer({ initialThreadId = null }: ChatContainerProps) {
  const [selectedModel, setSelectedModel] =
    useState<ModelId>("gemini-2.0-flash");

  const handleModelChange = (model: ModelId) => {
    console.log("[ChatContainer] Model changed to:", model);
    setSelectedModel(model);
  };

  return (
    <ChatArea
      initialThreadId={initialThreadId}
      selectedModel={selectedModel}
      onModelChange={handleModelChange}
    />
  );
}
