import { ChatContainer } from "@/components/chat/chat-container";

export default async function ThreadPage({
  params,
}: Readonly<{
  params: Promise<{ threadId: string }>;
}>) {
  const { threadId } = await params;
  return <ChatContainer initialThreadId={threadId} />;
}
