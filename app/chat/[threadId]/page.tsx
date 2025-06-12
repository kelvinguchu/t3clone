import { ChatArea } from "@/components/chat/chat-area";

interface ThreadPageProps {
  params: { threadId: string };
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { threadId } = await params;
  return <ChatArea initialThreadId={threadId} />;
}
