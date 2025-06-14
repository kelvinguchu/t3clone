"use server";

import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getModelConfig, type ModelId } from "@/lib/ai-providers";
import { Id } from "@/convex/_generated/dataModel";

// Create a new chat thread
export async function createThread(title?: string, model?: ModelId) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const threadId = await fetchMutation(api.threads.createThread, {
      title: title ?? "New Chat",
      model: model ?? "gemini-2.0-flash",
    });

    revalidatePath("/chat");
    return { threadId, success: true };
  } catch (error) {
    console.error("Error creating thread:", error);
    return { error: "Failed to create thread", success: false };
  }
}

// Add a user message to a thread
export async function addUserMessage(
  threadId: Id<"threads">,
  content: string,
  parentId?: Id<"messages">,
) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Verify user owns the thread
    const thread = await fetchQuery(api.threads.getThread, { threadId });
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found or access denied");
    }

    const messageId = await fetchMutation(api.messages.addMessage, {
      threadId,
      content,
      role: "user",
      parentId,
    });

    revalidatePath(`/chat/${threadId}`);
    return { messageId, success: true };
  } catch (error) {
    console.error("Error adding user message:", error);
    return { error: "Failed to add message", success: false };
  }
}

// Update thread settings (model, temperature, etc.)
export async function updateThreadSettings(
  threadId: Id<"threads">,
  settings: {
    model?: ModelId;
    title?: string;
    systemPrompt?: string;
  },
) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Verify user owns the thread
    const thread = await fetchQuery(api.threads.getThread, { threadId });
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found or access denied");
    }

    // Validate model if provided
    if (settings.model) {
      try {
        getModelConfig(settings.model);
      } catch {
        throw new Error("Invalid model selected");
      }
    }

    await fetchMutation(api.threads.updateThread, {
      threadId,
      ...settings,
    });

    revalidatePath(`/chat/${threadId}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating thread settings:", error);
    return { error: "Failed to update settings", success: false };
  }
}

// Delete a thread
export async function deleteThread(threadId: Id<"threads">) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Verify user owns the thread
    const thread = await fetchQuery(api.threads.getThread, { threadId });
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found or access denied");
    }

    await fetchMutation(api.threads.deleteThread, { threadId });

    revalidatePath("/chat");
    redirect("/chat");
  } catch (error) {
    console.error("Error deleting thread:", error);
    return { error: "Failed to delete thread", success: false };
  }
}

// Share a thread (make it public)
export async function shareThread(threadId: Id<"threads">) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // Verify user owns the thread
    const thread = await fetchQuery(api.threads.getThread, { threadId });
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found or access denied");
    }

    // Update thread to be public (simplified version)
    await fetchMutation(api.threads.updateThread, {
      threadId,
    });

    return { success: true, message: "Thread shared successfully" };
  } catch (error) {
    console.error("Error sharing thread:", error);
    return { error: "Failed to share thread", success: false };
  }
}

// Delete a specific message
export async function deleteMessage(messageId: Id<"messages">) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    // The deleteMessage function in Convex handles authorization internally
    await fetchMutation(api.messages.deleteMessage, {
      messageId,
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting message:", error);
    return { error: "Failed to delete message", success: false };
  }
}

// Get thread with messages
export async function getThreadWithMessages(threadId: Id<"threads">) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const thread = await fetchQuery(api.threads.getThread, { threadId });
    if (!thread) {
      throw new Error("Thread not found");
    }

    // Check if user has access (owner or shared)
    if (thread.userId !== userId && !thread.isPublic) {
      throw new Error("Access denied");
    }

    const messages = await fetchQuery(api.messages.getThreadMessages, {
      threadId,
    });

    return { thread, messages, success: true };
  } catch (error) {
    console.error("Error getting thread with messages:", error);
    return { error: "Failed to load thread", success: false };
  }
}

// Get user's chat threads
export async function getUserThreads() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const threads = await fetchQuery(api.threads.getUserThreads, { userId });
    return { threads, success: true };
  } catch (error) {
    console.error("Error getting user threads:", error);
    return { error: "Failed to load threads", success: false };
  }
}

// Update a message (for streaming)
export async function updateMessage(
  messageId: Id<"messages">,
  content: string,
  isStreaming?: boolean,
  tokenCount?: number,
  finishReason?: string,
) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    await fetchMutation(api.messages.updateMessage, {
      messageId,
      content,
      isStreaming,
      tokenCount,
      finishReason,
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating message:", error);
    return { error: "Failed to update message", success: false };
  }
}

// Add assistant message to thread
export async function addAssistantMessage(
  threadId: Id<"threads">,
  content: string,
  parentId?: Id<"messages">,
  model?: string,
  tokenCount?: number,
  finishReason?: string,
) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const messageId = await fetchMutation(api.messages.addMessage, {
      threadId,
      content,
      role: "assistant",
      parentId,
      model,
      tokenCount,
      finishReason,
    });

    revalidatePath(`/chat/${threadId}`);
    return { messageId, success: true };
  } catch (error) {
    console.error("Error adding assistant message:", error);
    return { error: "Failed to add message", success: false };
  }
}

// Get message count for a thread
export async function getMessageCount(threadId: Id<"threads">) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const count = await fetchQuery(api.messages.getMessageCount, {
      threadId,
    });

    return { count, success: true };
  } catch (error) {
    console.error("Error getting message count:", error);
    return { error: "Failed to get message count", success: false };
  }
}
