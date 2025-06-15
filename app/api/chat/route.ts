import {
  streamText,
  convertToCoreMessages,
  type CoreMessage,
  type Message,
} from "ai";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";

import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import {
  getModel,
  getModelConfig,
  getModelTools,
  validateProviderKeys,
  type ModelId,
} from "@/lib/ai-providers";
import { Id } from "@/convex/_generated/dataModel";
import {
  getOrCreateAnonymousSession,
  getAnonymousSession,
} from "@/lib/utils/session";
import { getSmartContext, conversationCache } from "@/lib/conversation-context";
import { streamCache } from "@/lib/kv";
import type { ConversationMessage } from "@/lib/kv";
import { activeSessions, stopSession } from "@/lib/tools/browser-tool";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

// Helper function to fetch attachments from Convex and convert messages to multimodal format
async function processMultimodalMessages(
  messages: Message[],
  attachmentIds?: string[],
  fetchOptions?: { token: string },
): Promise<CoreMessage[]> {
  console.log("[processMultimodalMessages] Starting with:", {
    messagesCount: messages.length,
    attachmentIdsCount: attachmentIds?.length || 0,
    hasFetchOptions: !!fetchOptions,
  });

  const coreMessages = convertToCoreMessages(messages);
  console.log(
    "[processMultimodalMessages] Converted to core messages:",
    coreMessages.length,
  );

  // Check if messages already have experimental_attachments (from AI SDK)
  const hasExperimentalAttachments = messages.some((msg) => {
    const attachments = (msg as { experimental_attachments?: unknown[] })
      .experimental_attachments;
    return attachments && attachments.length > 0;
  });

  console.log("[processMultimodalMessages] Experimental attachments check:", {
    hasExperimentalAttachments,
    messagesWithAttachments: messages
      .map((msg, idx) => ({
        index: idx,
        role: msg.role,
        hasAttachments: !!(msg as { experimental_attachments?: unknown[] })
          .experimental_attachments?.length,
        attachmentCount:
          (msg as { experimental_attachments?: unknown[] })
            .experimental_attachments?.length || 0,
      }))
      .filter((m) => m.hasAttachments),
  });

  // If messages have experimental_attachments, process them
  if (hasExperimentalAttachments) {
    console.log(
      "[processMultimodalMessages] Processing experimental_attachments from AI SDK",
    );

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const coreMessage = coreMessages[i];
      const experimentalAttachments = (
        message as {
          experimental_attachments?: Array<{
            name?: string;
            contentType?: string;
            url: string;
          }>;
        }
      ).experimental_attachments;

      if (
        experimentalAttachments &&
        experimentalAttachments.length > 0 &&
        coreMessage.role === "user"
      ) {
        console.log(
          `[processMultimodalMessages] Processing attachments for message ${i}:`,
          {
            attachmentCount: experimentalAttachments.length,
            attachments: experimentalAttachments.map((att) => ({
              name: att.name,
              contentType: att.contentType,
              hasUrl: !!att.url,
            })),
          },
        );

        // Convert text content to multimodal format
        const textContent =
          typeof coreMessage.content === "string"
            ? coreMessage.content
            : coreMessage.content.find((part) => part.type === "text")?.text ||
              "";

        const multimodalContent: Array<
          | { type: "text"; text: string }
          | { type: "image"; image: URL | string }
          | { type: "file"; data: Uint8Array; mimeType: string }
        > = [];

        // Add text content if present
        if (textContent.trim()) {
          multimodalContent.push({
            type: "text",
            text: textContent,
          });
        }

        // Process experimental_attachments
        for (const attachment of experimentalAttachments) {
          try {
            console.log("[processMultimodalMessages] Processing attachment:", {
              name: attachment.name,
              contentType: attachment.contentType,
              url: attachment.url?.substring(0, 100) + "...",
            });

            if (attachment.contentType?.startsWith("image/")) {
              try {
                let imageData;
                if (attachment.url.startsWith("data:")) {
                  // Data URL
                  const base64Data = attachment.url.split(",")[1];
                  const binary = Buffer.from(base64Data, "base64");
                  imageData = new Uint8Array(binary);
                } else {
                  // Fetch the image bytes and embed directly
                  const res = await fetch(attachment.url);
                  const arrayBuf = await res.arrayBuffer();
                  imageData = new Uint8Array(arrayBuf);
                }

                multimodalContent.push({
                  type: "file",
                  data: imageData,
                  mimeType: attachment.contentType,
                });
                console.log(
                  "[processMultimodalMessages] Added inline image attachment",
                );
              } catch (err) {
                console.error(
                  "[processMultimodalMessages] Failed to fetch/convert image:",
                  err,
                );
              }
            } else if (attachment.contentType === "application/pdf") {
              // For PDFs, fetch the content if it's a URL
              try {
                if (attachment.url.startsWith("data:")) {
                  // Handle data URL
                  const base64Data = attachment.url.split(",")[1];
                  const binaryData = atob(base64Data);
                  const uint8Array = new Uint8Array(binaryData.length);
                  for (let j = 0; j < binaryData.length; j++) {
                    uint8Array[j] = binaryData.charCodeAt(j);
                  }
                  multimodalContent.push({
                    type: "file",
                    data: uint8Array,
                    mimeType: attachment.contentType,
                  });
                } else {
                  // Handle regular URL
                  const response = await fetch(attachment.url);
                  const arrayBuffer = await response.arrayBuffer();
                  multimodalContent.push({
                    type: "file",
                    data: new Uint8Array(arrayBuffer),
                    mimeType: attachment.contentType,
                  });
                }
                console.log("[processMultimodalMessages] Added PDF attachment");
              } catch (error) {
                console.error(
                  "[processMultimodalMessages] Error processing PDF attachment:",
                  error,
                );
                continue;
              }
            }
          } catch (error) {
            console.error(
              "[processMultimodalMessages] Error processing experimental attachment:",
              error,
            );
            continue;
          }
        }

        // Update the message with multimodal content
        if (multimodalContent.length > 0) {
          console.log(
            "[processMultimodalMessages] Updated message with multimodal content:",
            multimodalContent.length,
          );
          coreMessage.content = multimodalContent;
        }
      }
    }
  }
  // If there are attachment IDs (legacy system), fetch them from Convex and convert to multimodal content
  else if (
    attachmentIds &&
    attachmentIds.length > 0 &&
    coreMessages.length > 0
  ) {
    console.log(
      "[processMultimodalMessages] Processing legacy attachmentIds:",
      attachmentIds,
    );

    const lastMessage = coreMessages[coreMessages.length - 1];
    if (lastMessage.role === "user") {
      // Convert text content to multimodal format
      const textContent =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : lastMessage.content.find((part) => part.type === "text")?.text ||
            "";

      const multimodalContent: Array<
        | { type: "text"; text: string }
        | { type: "image"; image: URL }
        | { type: "file"; data: Uint8Array; mimeType: string }
      > = [];

      // Add text content if present
      if (textContent.trim()) {
        multimodalContent.push({
          type: "text",
          text: textContent,
        });
      }

      // Fetch attachments from Convex and add them as multimodal content
      try {
        const { fetchQuery } = await import("convex/nextjs");

        for (const attachmentId of attachmentIds) {
          try {
            console.log(
              "[processMultimodalMessages] Fetching attachment:",
              attachmentId,
            );

            const attachment = await fetchQuery(
              api.attachments.getAttachment,
              { attachmentId: attachmentId as Id<"attachments"> },
              fetchOptions,
            );

            if (!attachment) {
              console.log(
                "[processMultimodalMessages] Attachment not found:",
                attachmentId,
              );
              continue;
            }

            console.log("[processMultimodalMessages] Attachment found:", {
              id: attachmentId,
              mimeType: attachment.mimeType,
              hasFileUrl: !!attachment.fileUrl,
            });

            if (attachment.mimeType.startsWith("image/")) {
              multimodalContent.push({
                type: "image",
                image: new URL(attachment.fileUrl),
              });
            } else if (attachment.mimeType === "application/pdf") {
              // For PDFs, fetch the content and convert to file part
              try {
                const response = await fetch(attachment.fileUrl);
                const arrayBuffer = await response.arrayBuffer();
                multimodalContent.push({
                  type: "file",
                  data: new Uint8Array(arrayBuffer),
                  mimeType: attachment.mimeType,
                });
              } catch (error) {
                console.error(
                  "[processMultimodalMessages] Error fetching PDF:",
                  error,
                );
                // If we can't fetch the file, skip it
                continue;
              }
            }
          } catch (error) {
            console.error(
              "[processMultimodalMessages] Error fetching attachment:",
              attachmentId,
              error,
            );
            // If we can't fetch this attachment, skip it
            continue;
          }
        }
      } catch (error) {
        console.error(
          "[processMultimodalMessages] Error importing fetchQuery:",
          error,
        );
        // If we can't fetch attachments, continue without them
      }

      // Update the last message with multimodal content
      if (multimodalContent.length > 0) {
        console.log(
          "[processMultimodalMessages] Updated message with multimodal content:",
          multimodalContent.length,
        );
        lastMessage.content = multimodalContent;
      }
    }
  }

  console.log(
    "[processMultimodalMessages] Returning core messages:",
    coreMessages.length,
  );
  return coreMessages;
}

// Retrieve Convex-compatible token (template "convex") for the current user
async function getConvexFetchOptions() {
  console.log("[getConvexFetchOptions] Starting auth check");

  const clerk = await auth();
  console.log("[getConvexFetchOptions] Auth result:", {
    hasUserId: !!clerk.userId,
    userId: clerk.userId,
  });

  if (!clerk.userId) return { userId: null, fetchOptions: undefined };

  const token = await clerk.getToken({ template: "convex" });
  console.log("[getConvexFetchOptions] Token result:", {
    hasToken: !!token,
    tokenLength: token?.length || 0,
  });

  return { userId: clerk.userId, fetchOptions: token ? { token } : undefined };
}

export async function POST(req: NextRequest) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[${requestId}] CHAT_API - Request received`, {
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method,
  });

  try {
    console.log(`[${requestId}] CHAT_API - Validating provider keys`);
    // Validate provider API keys
    validateProviderKeys();

    console.log(`[${requestId}] CHAT_API - Getting Convex fetch options`);
    const { userId, fetchOptions } = await getConvexFetchOptions();

    console.log(`[${requestId}] CHAT_API - Parsing request body`);
    const body = await req.json();
    console.log(`[${requestId}] CHAT_API - Request body parsed:`, {
      hasMessages: !!body.messages,
      messagesLength: body.messages?.length || 0,
      modelId: body.modelId,
      threadId: body.threadId,
      hasAttachmentIds: !!body.attachmentIds,
      attachmentIdsLength: body.attachmentIds?.length || 0,
      userId: userId || "anonymous",
    });

    const {
      messages,
      modelId = "gemini-2.0-flash" as ModelId,
      threadId: threadIdBody,
      temperature = 0.7,
      maxTokens = 2000,
      attachmentIds,
      enableWebBrowsing,
    } = body;

    // Allow header override (client may send X-Thread-Id)
    const threadIdHeader =
      req.headers.get("x-thread-id") ?? req.headers.get("X-Thread-Id");
    const threadId = threadIdBody ?? threadIdHeader ?? null;

    console.log(`[${requestId}] CHAT_API - Thread ID resolution:`, {
      threadIdBody,
      threadIdHeader,
      finalThreadId: threadId,
    });

    // Validate model
    console.log(`[${requestId}] CHAT_API - Getting model config for:`, modelId);
    const modelConfig = getModelConfig(modelId);
    console.log(`[${requestId}] CHAT_API - Model config:`, {
      provider: modelConfig.provider,
      maxTokens: modelConfig.maxTokens,
    });

    console.log(`[${requestId}] CHAT_API - Creating model instance`);
    const model = getModel(modelId);

    // Validate that model was created successfully
    if (!model) {
      console.error(
        `[${requestId}] CHAT_API - Failed to create model instance for:`,
        modelId,
      );
      throw new Error(`Failed to create model instance for ${modelId}`);
    }
    console.log(
      `[${requestId}] CHAT_API - Model instance created successfully`,
    );

    // ----------------------------------------------------
    // Extract anonymous session ID from headers/cookies so we can still
    // reference legacy anonymous threads *after* the user signs in.
    // This runs for BOTH authenticated and anonymous requests.
    // ----------------------------------------------------
    let sessionId: string | null = null;
    let remainingMessages = 0;

    const headerSessionId =
      req.headers.get("x-session-id") ?? req.headers.get("X-Session-ID");

    const cookieSessionId = (await cookies()).get("anon_session_id")?.value;

    sessionId = headerSessionId ?? cookieSessionId ?? null;

    console.log(`[${requestId}] CHAT_API - Session ID resolution:`, {
      headerSessionId,
      cookieSessionId,
      finalSessionId: sessionId,
      isAuthenticated: !!userId,
    });

    // Handle anonymous users -------------------------------------------------
    if (!userId) {
      console.log(`[${requestId}] CHAT_API - Handling anonymous user`);

      // Validate session if provided
      if (sessionId) {
        console.log(
          `[${requestId}] CHAT_API - Validating existing session:`,
          sessionId,
        );
        const existing = await getAnonymousSession(sessionId);
        if (!existing) {
          console.log(`[${requestId}] CHAT_API - Session not found, resetting`);
          sessionId = null;
        } else {
          console.log(`[${requestId}] CHAT_API - Session validated:`, {
            remainingMessages: existing.remainingMessages,
          });
        }
      }

      // If no valid client session, create / reuse based on IP + UA
      if (!sessionId) {
        console.log(`[${requestId}] CHAT_API - Creating new session`);
        const preferredId = cookieSessionId ?? undefined;

        if (preferredId) {
          console.log(
            `[${requestId}] CHAT_API - Checking preferred session ID:`,
            preferredId,
          );
          const existing = await getAnonymousSession(preferredId);
          if (existing) {
            console.log(
              `[${requestId}] CHAT_API - Using existing preferred session`,
            );
            sessionId = existing.sessionId;
          }
        }

        if (!sessionId) {
          console.log(
            `[${requestId}] CHAT_API - Creating completely new session`,
          );
          const userAgent = req.headers.get("user-agent") ?? "";
          const ip =
            req.headers.get("x-forwarded-for") ??
            req.headers.get("x-real-ip") ??
            "unknown";
          const ipHash = btoa(ip).slice(0, 16); // Simple hash for privacy

          const sessionData = await getOrCreateAnonymousSession(
            userAgent,
            ipHash,
          );
          sessionId = sessionData.sessionId;
          console.log(
            `[${requestId}] CHAT_API - New session created:`,
            sessionId,
          );
        }
      }

      // ---------------------------------------------
      // Rate-limit check using Convex session stats
      // This keeps server-side logic in sync with the
      // stats used by the client UI.
      // ---------------------------------------------
      try {
        console.log(
          `[${requestId}] CHAT_API - Checking rate limits for session:`,
          sessionId,
        );
        // Dynamically import fetchQuery to avoid circular deps
        const { fetchQuery } = await import("convex/nextjs");

        const sessionStats = await fetchQuery(
          api.sessionStats.getAnonymousSessionStats,
          { sessionId: sessionId! },
        );

        console.log(`[${requestId}] CHAT_API - Session stats:`, {
          remainingMessages: sessionStats.remainingMessages,
        });

        if (sessionStats.remainingMessages <= 0) {
          console.log(`[${requestId}] CHAT_API - Rate limit exceeded`);
          return new Response(
            JSON.stringify({
              error: "Message limit exceeded. Please sign up to continue.",
              code: "RATE_LIMITED",
            }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }

        // Reserve one message slot for this request so that extremely fast
        // consecutive requests can't race the limit. We don't need to make an
        // extra write because the user message will be persisted in Convex
        // right after this check.
        remainingMessages = Math.max(0, sessionStats.remainingMessages - 1);
        console.log(
          `[${requestId}] CHAT_API - Reserved message slot, remaining:`,
          remainingMessages,
        );
      } catch (error) {
        console.error(
          `[${requestId}] CHAT_API - Error checking Convex session stats:`,
          error,
        );
        // In case of failure, fall back to previous KV-based logic to avoid
        // blocking the user unnecessarily.
        const fallbackSession = await getAnonymousSession(sessionId!);
        if (!fallbackSession || fallbackSession.remainingMessages <= 0) {
          console.log(`[${requestId}] CHAT_API - Fallback rate limit exceeded`);
          return new Response(
            JSON.stringify({
              error: "Message limit exceeded. Please sign up to continue.",
              code: "RATE_LIMITED",
            }),
            { status: 429, headers: { "Content-Type": "application/json" } },
          );
        }
        remainingMessages = Math.max(0, fallbackSession.remainingMessages - 1);
        console.log(
          `[${requestId}] CHAT_API - Fallback remaining messages:`,
          remainingMessages,
        );
      }
    }

    let finalThreadId = threadId;

    // Create thread if it doesn't exist (for new conversations)
    if (!finalThreadId && messages.length > 0) {
      console.log(`[${requestId}] CHAT_API - Creating new thread`);
      const lastMessage = messages[messages.length - 1];

      // Smart title: strip markdown/code fences and limit length
      const raw = lastMessage.content
        .replace(/```[\s\S]*?```/g, "") // remove code fences
        .replace(/`([^`]*)`/g, "$1") // inline code
        .replace(/\n+/g, " ")
        .trim();

      const smartTitle = raw.split(" ").slice(0, 12).join(" ");
      console.log(
        `[${requestId}] CHAT_API - Generated smart title:`,
        smartTitle,
      );

      if (userId) {
        console.log(`[${requestId}] CHAT_API - Creating authenticated thread`);
        // Authenticated user - create thread in Convex
        finalThreadId = await fetchMutation(
          api.threads.createThread,
          {
            title: smartTitle || "New Chat",
            model: modelId,
          },
          fetchOptions,
        );
        console.log(
          `[${requestId}] CHAT_API - Authenticated thread created:`,
          finalThreadId,
        );
      } else {
        console.log(`[${requestId}] CHAT_API - Creating anonymous thread`);
        // Anonymous user - create anonymous thread
        finalThreadId = await fetchMutation(api.threads.createAnonymousThread, {
          sessionId: sessionId!,
          title: smartTitle || "New Chat",
          model: modelId,
        });
        console.log(
          `[${requestId}] CHAT_API - Anonymous thread created:`,
          finalThreadId,
        );
      }
    }

    // Add user message to database if we have a thread
    if (finalThreadId && messages.length > 0) {
      console.log(`[${requestId}] CHAT_API - Adding user message to database`);
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === "user") {
        let messageId: string | undefined;

        if (userId) {
          console.log(
            `[${requestId}] CHAT_API - Adding authenticated user message`,
          );
          messageId = await fetchMutation(
            api.messages.addMessage,
            {
              threadId: finalThreadId as Id<"threads">,
              content: lastMessage.content,
              role: "user",
            },
            fetchOptions,
          );
          console.log(
            `[${requestId}] CHAT_API - Authenticated message added:`,
            messageId,
          );
        } else {
          console.log(
            `[${requestId}] CHAT_API - Adding anonymous user message`,
          );
          messageId = await fetchMutation(api.messages.createAnonymousMessage, {
            threadId: finalThreadId as Id<"threads">,
            sessionId: sessionId!,
            content: lastMessage.content,
            role: "user",
            ...(sessionId ? { sessionId } : {}),
          });
          console.log(
            `[${requestId}] CHAT_API - Anonymous message added:`,
            messageId,
          );
        }

        // Link attachments to the message and thread if we have attachment IDs
        if (attachmentIds && attachmentIds.length > 0 && messageId) {
          console.log(
            `[${requestId}] CHAT_API - Linking attachments to message:`,
            {
              attachmentIds,
              messageId,
              threadId: finalThreadId,
            },
          );

          try {
            for (const attachmentId of attachmentIds) {
              console.log(
                `[${requestId}] CHAT_API - Linking attachment:`,
                attachmentId,
              );
              await fetchMutation(
                api.attachments.linkAttachmentToThread,
                {
                  attachmentId: attachmentId as Id<"attachments">,
                  threadId: finalThreadId as Id<"threads">,
                  messageId: messageId as Id<"messages">,
                },
                fetchOptions,
              );
              console.log(
                `[${requestId}] CHAT_API - Attachment linked successfully:`,
                attachmentId,
              );
            }
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Error linking attachments:`,
              error,
            );
            // Don't fail the request if attachment linking fails
          }
        }

        // Cache the user message for conversation context
        const conversationMessage: ConversationMessage = {
          role: "user",
          content: lastMessage.content,
          timestamp: Date.now(),
          model: modelId,
          messageId: `user-${Date.now()}`,
        };

        try {
          console.log(`[${requestId}] CHAT_API - Caching user message`);
          await conversationCache.appendMessage(
            finalThreadId,
            conversationMessage,
          );
          console.log(
            `[${requestId}] CHAT_API - User message cached successfully`,
          );
        } catch (error) {
          console.error(
            `[${requestId}] CHAT_API - Error caching user message:`,
            error,
          );
          // Don't fail the request if caching fails
        }
      }
    }

    // Note: Message count is already incremented above for anonymous users

    // ============================================================================
    // INJECT CONVERSATION CONTEXT FROM KV CACHE
    // ============================================================================
    let contextualMessages: CoreMessage[] = [];

    console.log(`[${requestId}] CHAT_API - Loading conversation context`);
    if (finalThreadId) {
      try {
        console.log(
          `[${requestId}] CHAT_API - Getting smart context for thread:`,
          finalThreadId,
        );
        const conversationContext = await getSmartContext(
          finalThreadId,
          modelId,
        );

        if (conversationContext && conversationContext.messages.length > 0) {
          console.log(
            `[${requestId}] CHAT_API - Using cached conversation context:`,
            conversationContext.messages.length,
          );
          // Use the cached conversation context instead of just the client messages
          contextualMessages = conversationContext.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));
        } else {
          console.log(
            `[${requestId}] CHAT_API - No cached context, loading from database`,
          );
          // Fallback: Load from database and populate cache
          try {
            const { fetchQuery } = await import("convex/nextjs");

            const dbMessages = await fetchQuery(
              api.messages.getThreadMessages,
              {
                threadId: finalThreadId as Id<"threads">,
                ...(sessionId && !userId ? { sessionId } : {}),
              },
              fetchOptions,
            );

            console.log(
              `[${requestId}] CHAT_API - Database messages loaded:`,
              dbMessages?.length || 0,
            );

            if (dbMessages && dbMessages.length > 0) {
              console.log(
                `[${requestId}] CHAT_API - Populating cache with database messages`,
              );
              // Populate cache with database messages
              for (const dbMsg of dbMessages) {
                const conversationMessage: ConversationMessage = {
                  role: dbMsg.role,
                  content: dbMsg.content,
                  timestamp: dbMsg.createdAt,
                  model: (dbMsg as { model?: string }).model || modelId,
                  messageId:
                    (dbMsg as { _id?: string })._id ||
                    `${dbMsg.role}-${dbMsg.createdAt}`,
                };

                try {
                  await conversationCache.appendMessage(
                    finalThreadId,
                    conversationMessage,
                  );
                } catch (error) {
                  console.error(
                    `[${requestId}] CHAT_API - Error caching individual message:`,
                    error,
                  );
                  // Continue if individual message caching fails
                }
              }

              // Now try to get the context again
              console.log(
                `[${requestId}] CHAT_API - Attempting to get populated context`,
              );
              const populatedContext = await getSmartContext(
                finalThreadId,
                modelId,
              );
              if (populatedContext && populatedContext.messages.length > 0) {
                console.log(
                  `[${requestId}] CHAT_API - Using populated context:`,
                  populatedContext.messages.length,
                );
                contextualMessages = populatedContext.messages.map((msg) => ({
                  role: msg.role,
                  content: msg.content,
                }));
              } else {
                console.log(
                  `[${requestId}] CHAT_API - Still no context, using database messages directly`,
                );
                // Still no context, use database messages directly
                contextualMessages = dbMessages.map((msg) => ({
                  role: msg.role,
                  content: msg.content,
                }));
              }
            } else {
              console.log(
                `[${requestId}] CHAT_API - No database messages, processing multimodal messages`,
              );
              contextualMessages = await processMultimodalMessages(
                messages,
                attachmentIds,
                fetchOptions,
              );
            }
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Error loading from database:`,
              error,
            );
            contextualMessages = await processMultimodalMessages(
              messages,
              attachmentIds,
              fetchOptions,
            );
          }
        }
      } catch (error) {
        console.error(
          `[${requestId}] CHAT_API - Error loading conversation context:`,
          error,
        );
        // Fallback to client messages if context loading fails
        contextualMessages = await processMultimodalMessages(
          messages,
          attachmentIds,
          fetchOptions,
        );
      }
    } else {
      console.log(
        `[${requestId}] CHAT_API - No thread ID, using client messages`,
      );
      // No thread ID means new conversation, use client messages
      contextualMessages = await processMultimodalMessages(
        messages,
        attachmentIds,
        fetchOptions,
      );
    }

    // --------------------------------------------------------------------
    // Always ensure the *current* client messages (the ones just posted)
    // are present in the final prompt *with* their multimodal attachments.
    // Cached context does not store attachment information, so we run
    // processMultimodalMessages on the raw client messages again and merge
    // the result – deduplicating by role+content to avoid doubles.
    // --------------------------------------------------------------------

    const currentMessagesProcessed = await processMultimodalMessages(
      messages,
      attachmentIds,
      fetchOptions,
    );

    // Create a simple helper to compare messages (stringify content for deep equality)
    const serialize = (m: CoreMessage) =>
      `${m.role}:${JSON.stringify(m.content)}`;

    const contextualSerialized = new Set(contextualMessages.map(serialize));

    for (const m of currentMessagesProcessed) {
      if (!contextualSerialized.has(serialize(m))) {
        contextualMessages.push(m);
      }
    }

    const finalMessages: CoreMessage[] = [...contextualMessages];

    // ---------------------------------------------------------------
    // Remove messages that have NO meaningful parts. This situation
    // can happen when a draft assistant placeholder (content: "") or
    // an empty user-message slipped into the context. Gemini rejects
    // requests whose `contents[i].parts` array is empty, returning
    // "contents.parts must not be empty". We keep only messages that
    // have at least one non-empty text part or any non-text part.
    // ---------------------------------------------------------------

    const hasUsefulParts = (m: CoreMessage): boolean => {
      if (typeof m.content === "string") {
        return m.content.trim().length > 0;
      }
      return m.content.some((part) => {
        if (part.type === "text") {
          return (part.text ?? "").trim().length > 0;
        }
        // Any file/image/tool part is useful
        return true;
      });
    };

    const filteredMessages = finalMessages.filter(hasUsefulParts);

    console.log(`[${requestId}] CHAT_API - Final messages prepared:`, {
      totalMessages: filteredMessages.length,
      contextualMessagesCount: contextualMessages.length,
      firstMessageRole: filteredMessages[0]?.role,
      hasSystemMessage: filteredMessages.some((m) => m.role === "system"),
      messageRoles: filteredMessages.map((m) => m.role),
      webBrowsingEnabled: enableWebBrowsing,
    });

    // Use the filtered list from here on
    // eslint-disable-next-line prefer-const
    let messagesForAI = filteredMessages;

    // Add system message for web browsing when enabled
    if (enableWebBrowsing && getModelTools(modelId)) {
      const webBrowsingSystemMessage: CoreMessage = {
        role: "system",
        content:
          "You are a web browsing assistant. You MUST use the available browser tools to search for information and browse websites. When a user asks any question that could benefit from current information or web content, you MUST:\n\n1. First create a browser session using the webBrowser tool\n2. Then use googleSearch to search for relevant information, OR use getPageContent to read specific URLs\n3. Always provide the sessionId and debuggerFullscreenUrl from the session creation to subsequent tools\n\nNEVER respond with 'I cannot browse the internet' - you have full web browsing capabilities through these tools. Always use them when appropriate.",
      };

      // Insert system message at the beginning if no system message exists
      const hasSystemMessage = messagesForAI.some((m) => m.role === "system");
      if (!hasSystemMessage) {
        messagesForAI.unshift(webBrowsingSystemMessage);
      } else {
        // If system message exists, append web browsing instruction to it
        const systemMessageIndex = messagesForAI.findIndex(
          (m) => m.role === "system",
        );
        if (systemMessageIndex !== -1) {
          const existingContent = messagesForAI[systemMessageIndex].content;
          messagesForAI[systemMessageIndex].content =
            typeof existingContent === "string"
              ? `${existingContent}\n\n${webBrowsingSystemMessage.content}`
              : webBrowsingSystemMessage.content;
        }
      }
    }

    // Get tools for this model if web browsing is enabled
    console.log(
      `[${requestId}] CHAT_API - Web browsing enabled:`,
      enableWebBrowsing,
    );

    const tools = enableWebBrowsing ? getModelTools(modelId) : undefined;
    console.log(
      `[${requestId}] CHAT_API - Available tools:`,
      tools ? Object.keys(tools) : "none",
    );

    // Configure tool choice - when web browsing is enabled, prefer tool usage
    const toolChoice =
      enableWebBrowsing && tools ? ("auto" as const) : undefined;
    console.log(`[${requestId}] CHAT_API - Tool choice:`, toolChoice);

    // ------------------------------------------------------------------
    // Create draft assistant message so that UI can display it immediately
    // and be updated as tokens arrive (supports refresh-resume).
    // ------------------------------------------------------------------

    let assistantDraftId: Id<"messages"> | undefined;

    try {
      assistantDraftId = await fetchMutation(
        api.messages.addMessage,
        {
          threadId: finalThreadId as Id<"threads">,
          role: "assistant",
          content: "", // placeholder
          model: modelId,
        },
        fetchOptions,
      );
      console.log(
        `[${requestId}] CHAT_API - Draft assistant message created:`,
        assistantDraftId,
      );
      // Mark the placeholder as streaming so UI can show in-progress state
      if (assistantDraftId) {
        try {
          await fetchMutation(
            api.messages.setMessageStreamingStatus,
            {
              messageId: assistantDraftId,
              isStreaming: true,
              streamId: undefined,
              ...(sessionId && !userId ? { sessionId } : {}),
            },
            fetchOptions,
          );
        } catch (err) {
          console.error(
            `[${requestId}] CHAT_API - Failed to set streaming status:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error(
        `[${requestId}] CHAT_API - Failed creating draft assistant message:`,
        err,
      );
    }

    // Stream the AI response
    console.log(
      `[${requestId}] CHAT_API - Starting streamText with model:`,
      modelId,
    );

    let streamBuffer = "";
    let lastTokenTime = Date.now();
    let tokenIndex = 0;
    let isToolExecuting = false;
    let streamFinished = false;

    const streamTextConfig = {
      model,
      messages: messagesForAI,
      temperature,
      maxTokens: Math.min(maxTokens, modelConfig.maxTokens),
      ...(tools && { tools }),
      ...(toolChoice && { toolChoice }),
      // Enable multi-step tool execution when tools are available
      ...(tools && { maxSteps: 5 }),
      // Enable tool call streaming for better UX (match working example)
      ...(tools && { experimental_toolCallStreaming: true }),

      // ----------------------------------------------------------------
      // Track tool execution to prevent timeout during legitimate tool calls
      // ----------------------------------------------------------------
      onChunk: async (chunk: {
        chunk: { type: string; toolName?: string };
      }) => {
        if (chunk.chunk.type === "tool-call") {
          console.log(
            `[${requestId}] CHAT_API - Tool call started:`,
            chunk.chunk.toolName,
          );
          isToolExecuting = true;
          lastTokenTime = Date.now(); // Reset timeout during tool calls
        } else if (chunk.chunk.type === "tool-result") {
          console.log(
            `[${requestId}] CHAT_API - Tool call completed:`,
            chunk.chunk.toolName,
          );
          isToolExecuting = false;
          lastTokenTime = Date.now(); // Reset timeout after tool completion
        } else if (chunk.chunk.type === "text-delta") {
          lastTokenTime = Date.now(); // Reset timeout on text tokens
        }
      },

      // ----------------------------------------------------------------
      // Patch assistant content & checkpoint every ~128 tokens
      // ----------------------------------------------------------------
      onToken: async (token: string) => {
        const index = tokenIndex++;
        lastTokenTime = Date.now();

        console.log(
          `[${requestId}] CHAT_API - onToken received: '${token.replace(/\n/g, "\\n").slice(0, 20)}...' (index ${index})`,
        );

        if (!assistantDraftId) return;

        streamBuffer += token;

        // Patch on first token and then every 16 tokens
        if (index === 0 || index % 16 === 0) {
          try {
            await fetchMutation(
              api.messages.updateMessage,
              {
                messageId: assistantDraftId,
                content: streamBuffer,
                isStreaming: true,
              },
              fetchOptions,
            );

            console.log(
              `[${requestId}] CHAT_API - Patched assistant draft with ${streamBuffer.length} chars at token index ${index}`,
            );

            if (index % 128 === 0) {
              await streamCache.setCheckpoint(finalThreadId!, index);
            }
          } catch (err) {
            console.error(
              `[${requestId}] CHAT_API - Error patching streaming message:`,
              err,
            );
          }
        }
      },
    };

    const result = streamText({
      ...streamTextConfig,
      onFinish: async ({ text, usage, finishReason }) => {
        console.log(
          `[${requestId}] CHAT_API - onFinish called, final text length ${text.length}`,
        );
        // first execute incremental final patch
        if (assistantDraftId) {
          try {
            await fetchMutation(
              api.messages.updateMessage,
              {
                messageId: assistantDraftId,
                content: text,
                isStreaming: false,
                tokenCount: usage?.totalTokens,
                finishReason,
              },
              fetchOptions,
            );
          } catch (err) {
            console.error(
              `[${requestId}] CHAT_API - Error finalising assistant draft:`,
              err,
            );
          }
        }

        console.log(`[${requestId}] CHAT_API - streamText onFinish called:`, {
          textLength: text.length,
          usage,
          finishReason,
        });

        // Save assistant response to database when no draft was created (fallback)
        if (!assistantDraftId && finalThreadId) {
          try {
            console.log(
              `[${requestId}] CHAT_API - Saving assistant response to database`,
            );
            if (userId) {
              await fetchMutation(
                api.messages.addMessage,
                {
                  threadId: finalThreadId as Id<"threads">,
                  content: text,
                  role: "assistant",
                  model: modelId,
                  tokenCount: usage?.totalTokens,
                  finishReason,
                },
                fetchOptions,
              );
              console.log(
                `[${requestId}] CHAT_API - Authenticated assistant message saved`,
              );
            } else {
              await fetchMutation(api.messages.createAnonymousMessage, {
                threadId: finalThreadId as Id<"threads">,
                sessionId: sessionId!,
                content: text,
                role: "assistant",
                model: modelId,
                ...(sessionId ? { sessionId } : {}),
              });
              console.log(
                `[${requestId}] CHAT_API - Anonymous assistant message saved`,
              );
            }

            // Cache the assistant response for conversation context
            const assistantMessage: ConversationMessage = {
              role: "assistant",
              content: text,
              timestamp: Date.now(),
              model: modelId,
              messageId: `assistant-${Date.now()}`,
            };

            try {
              console.log(
                `[${requestId}] CHAT_API - Caching assistant message`,
              );
              await conversationCache.appendMessage(
                finalThreadId,
                assistantMessage,
              );
              console.log(
                `[${requestId}] CHAT_API - Assistant message cached successfully`,
              );
            } catch (error) {
              console.error(
                `[${requestId}] CHAT_API - Error caching assistant message:`,
                error,
              );
              // Don't fail the request if caching fails
            }
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Error saving assistant message:`,
              error,
            );
            // Error saving assistant message - continue
          }
        }

        // ------------------------------------------------------------------
        // Browserbase session cleanup – stop any sessions opened during run
        // ------------------------------------------------------------------
        try {
          if (activeSessions.size > 0) {
            console.log(
              `[${requestId}] CHAT_API - Cleaning up ${activeSessions.size} Browserbase session(s)`,
            );
            for (const id of Array.from(activeSessions)) {
              await stopSession(id);
              activeSessions.delete(id);
            }
          }
        } catch (err) {
          console.warn(
            `[${requestId}] CHAT_API - Error while stopping Browserbase sessions:`,
            err,
          );
        }

        // Track usage for authenticated users
        if (userId && usage) {
          try {
            console.log(
              `[${requestId}] CHAT_API - Tracking usage for authenticated user`,
            );
            const inputTokens = usage.promptTokens || 0;
            const outputTokens = usage.completionTokens || 0;
            const inputCost =
              (inputTokens / 1000) * modelConfig.costPer1kTokens.input;
            const outputCost =
              (outputTokens / 1000) * modelConfig.costPer1kTokens.output;
            const totalCostCents = Math.round((inputCost + outputCost) * 100);

            await fetchMutation(
              api.users.updateUsage,
              {
                userId,
                provider: modelConfig.provider,
                tokens: inputTokens + outputTokens,
                costInCents: totalCostCents,
              },
              fetchOptions,
            );
            console.log(`[${requestId}] CHAT_API - Usage tracked successfully`);
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Error tracking usage:`,
              error,
            );
            // Error tracking usage - continue
          }
        }
      },
      onError: (error) => {
        console.error(
          `[${requestId}] CHAT_API - streamText onError called:`,
          error,
        );
        // Stream error occurred - handled by client
      },
    });

    console.log(
      `[${requestId}] CHAT_API - streamText result created, preparing response`,
    );

    // ---------------------------------------------------------------------
    // NEW: Run streaming in the background and immediately return a JSON
    // response so that the HTTP request is not tied to the lifetime of the
    // generation task. This allows the browser to refresh (destroying the
    // original connection) without killing the model generation.
    // ---------------------------------------------------------------------

    const backgroundStream = async () => {
      const TIMEOUT_MS = 60000; // 1 minute without any token
      const TOOL_TIMEOUT_MS = 90000; // 90 seconds when tools are executing
      try {
        const timeoutWatcher = () =>
          new Promise((_, reject) => {
            const check = () => {
              if (streamFinished) return; // stop checks once stream is done
              const currentTimeout = isToolExecuting
                ? TOOL_TIMEOUT_MS
                : TIMEOUT_MS;
              const timeSinceLastToken = Date.now() - lastTokenTime;

              console.log(`[${requestId}] CHAT_API - Timeout check:`, {
                timeSinceLastToken,
                currentTimeout,
                isToolExecuting,
                willTimeout: timeSinceLastToken > currentTimeout,
              });

              if (timeSinceLastToken > currentTimeout) {
                const timeoutType = isToolExecuting
                  ? "Tool execution timeout"
                  : "LLM timeout";
                console.log(
                  `[${requestId}] CHAT_API - ${timeoutType} triggered after ${timeSinceLastToken}ms`,
                );
                reject(new Error("LLM timeout"));
              } else {
                setTimeout(check, 5000);
              }
            };
            setTimeout(check, 5000);
          });

        const consume = async () => {
          try {
            const maybeIterable = result as unknown as {
              [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
              text?: () => Promise<string>;
              // TEXT_STREAM & FULL_STREAM SUPPORT ----------------------------
              textStream?: AsyncIterable<unknown> | ReadableStream;
              fullStream?: AsyncIterable<unknown> | ReadableStream;
            };

            if (typeof maybeIterable[Symbol.asyncIterator] === "function") {
              // Drain the async iterator to ensure onToken/onFinish are fired.
              for await (const _chunk of maybeIterable as AsyncIterable<unknown>) {
                void _chunk; // discard – onToken already handles content
              }
            } else if (typeof maybeIterable.textStream === "object") {
              //   ai-sdk >=4 returns { textStream, fullStream } – prefer textStream.
              const stream = maybeIterable.textStream as
                | AsyncIterable<unknown>
                | ReadableStream;
              const potentialIterable = stream as unknown as {
                [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
              };
              if (
                typeof potentialIterable[Symbol.asyncIterator] === "function"
              ) {
                for await (const _chunk of stream as AsyncIterable<unknown>) {
                  void _chunk;
                }
              } else if (
                typeof (stream as ReadableStream).getReader === "function"
              ) {
                const reader = (stream as ReadableStream).getReader();
                // eslint-disable-next-line no-constant-condition
                while (true) {
                  const { done } = await reader.read();
                  if (done) break;
                }
              }
            } else if (typeof maybeIterable.fullStream === "object") {
              // Fallback to fullStream when textStream is not present.
              const stream = maybeIterable.fullStream as
                | AsyncIterable<unknown>
                | ReadableStream;
              const potentialIterable = stream as unknown as {
                [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
              };
              if (
                typeof potentialIterable[Symbol.asyncIterator] === "function"
              ) {
                for await (const _chunk of stream as AsyncIterable<unknown>) {
                  void _chunk;
                }
              } else if (
                typeof (stream as ReadableStream).getReader === "function"
              ) {
                const reader = (stream as ReadableStream).getReader();
                // eslint-disable-next-line no-constant-condition
                while (true) {
                  const { done } = await reader.read();
                  if (done) break;
                }
              }
            } else if (typeof maybeIterable.text === "function") {
              // Fallback: await full text (may produce no tokens for non-streaming models).
              await maybeIterable.text();
            } else {
              // Last resort: try toReadableStream()
              const readable = (
                result as unknown as { toReadableStream?: () => ReadableStream }
              ).toReadableStream?.();
              if (readable) {
                const reader = readable.getReader();
                // eslint-disable-next-line no-constant-condition
                while (true) {
                  const { done } = await reader.read();
                  if (done) break;
                }
              } else {
                console.warn(
                  `[${requestId}] CHAT_API - Unknown streamText result type; cannot consume`,
                );
              }
            }
            streamFinished = true; // mark done when consume exits
          } catch (err) {
            console.error(`[${requestId}] CHAT_API - consume() error:`, err);
            throw err;
          }
        };

        await Promise.race([consume(), timeoutWatcher()]);
      } catch (err) {
        console.error(
          `[${requestId}] CHAT_API - Background streamText error:`,
          err,
        );
        // Mark the draft message as errored so UI can react
        if (assistantDraftId) {
          try {
            await fetchMutation(
              api.messages.updateMessage,
              {
                messageId: assistantDraftId,
                content:
                  "⚠️ Model did not respond in time. Please try again or pick a different model.",
                isStreaming: false,
                finishReason: "error",
              },
              fetchOptions,
            );
          } catch (patchErr) {
            console.error(
              `[${requestId}] CHAT_API - Failed to mark timeout message:`,
              patchErr,
            );
          }
        }
      }
    };

    // Fire-and-forget – do **not** await so that the HTTP handler can finish.
    void backgroundStream();

    // Prepare headers (rate-limit + thread info)
    const responseHeaders = new Headers();
    if (!userId) {
      responseHeaders.set(
        "X-RateLimit-Remaining",
        remainingMessages.toString(),
      );
      responseHeaders.set("X-RateLimit-Limit", "10");
    }
    if (finalThreadId) {
      responseHeaders.set("X-Thread-Id", finalThreadId);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        threadId: finalThreadId,
        assistantMessageId: assistantDraftId,
      }),
      {
        status: 202,
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(responseHeaders.entries()),
        },
      },
    );

    // ---------------------------------------------------------------------
    // The legacy data-stream response below is now unreachable because we
    // returned early. It is intentionally left in place (behind this return)
    // to minimise diff size and can be removed in a future cleanup.
    // ---------------------------------------------------------------------
  } catch (error) {
    console.error(
      `[${requestId}] CHAT_API - Top-level error in chat API:`,
      error,
    );

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("Missing required environment variables")) {
        console.error(
          `[${requestId}] CHAT_API - Configuration error:`,
          error.message,
        );
        return new Response(
          JSON.stringify({
            error: "AI service configuration error",
            type: "CONFIG_ERROR",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      if (
        error.message.includes("Model") &&
        error.message.includes("not found")
      ) {
        console.error(
          `[${requestId}] CHAT_API - Invalid model error:`,
          error.message,
        );
        return new Response(
          JSON.stringify({
            error: "Invalid model selected",
            type: "INVALID_MODEL",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    console.error(
      `[${requestId}] CHAT_API - Unknown error, returning generic error response`,
    );
    return new Response(
      JSON.stringify({
        error: "Failed to generate response. Please try again.",
        type: "UNKNOWN_ERROR",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
