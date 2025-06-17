import { ChatContainer } from "@/components/chat/chat-container";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat - AI Assistant",
  description: "Start a new conversation with your AI assistant",
};

export default function ChatIndexPage() {
  return <ChatContainer />;
}
