import { ChatContainer } from "@/components/chat/chat-container";
import { cookies } from "next/headers";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getConvexFetchOptions } from "@/lib/actions/api/chat/auth-utils";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ threadId: string }>;
};

// Server-side function to safely query thread data with proper auth context
async function getThreadForMetadata(threadId: string) {
  try {
    const { userId, fetchOptions } = await getConvexFetchOptions();
    const cookieStore = await cookies();
    const anonSessionId = cookieStore.get("anon_session_id")?.value;

    // For authenticated users, try to fetch the thread with Clerk token
    if (userId && fetchOptions) {
      return await fetchQuery(
        api.threads.getThread,
        {
          threadId: threadId as Id<"threads">,
          // ALSO pass sessionId if it exists. This covers the case where a user
          // creates an anonymous thread and immediately signs in. The thread
          // is still anonymous until claimed, but the metadata runs as authenticated.
          ...(anonSessionId && { sessionId: anonSessionId }),
        },
        fetchOptions,
      );
    }

    // For anonymous users, check if we have a session ID
    if (anonSessionId) {
      return await fetchQuery(
        api.threads.getThread,
        {
          threadId: threadId as Id<"threads">,
          sessionId: anonSessionId,
        },
        // No fetchOptions for anonymous users
      );
    }

    // No auth context available, return null for fallback metadata
    return null;
  } catch (error) {
    console.error("Error fetching thread for metadata:", error);
    return null;
  }
}

// Generate metadata for the page
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { threadId } = await params;

    // Safely fetch thread data with auth context
    const thread = await getThreadForMetadata(threadId);

    // If thread doesn't exist or user doesn't have access, return default metadata
    if (!thread) {
      return {
        title: "Chat Conversation",
        description: "AI Chat Conversation",
      };
    }

    // Clean the title for display (remove markdown formatting)
    const cleanTitle =
      thread.title
        ?.replace(/```[\s\S]*?```/g, "")
        ?.replace(/`([^`]*)`/g, "$1")
        ?.replace(/\n+/g, " ")
        ?.trim() || "New Chat";

    return {
      title: `${cleanTitle} - Chat`,
      description: `Chat conversation: ${cleanTitle}`,
    };
  } catch (error) {
    console.error("Error generating metadata for thread:", error);
    return {
      title: "Chat Conversation",
      description: "AI Chat Conversation",
    };
  }
}

export default async function ThreadPage({ params }: Readonly<PageProps>) {
  const { threadId } = await params;

  // Let the ChatContainer handle thread validation and redirection client-side
  // This avoids server-side auth issues while maintaining the same UX
  return <ChatContainer initialThreadId={threadId} />;
}
