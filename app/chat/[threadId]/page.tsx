import { ChatContainer } from "@/components/chat/chat-container";

interface ThreadPageProps {
  params: { threadId: string };
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { threadId } = await params;
  return <ChatContainer initialThreadId={threadId} />;
}
