import {
  streamText,
  convertToCoreMessages,
  type CoreMessage,
  type Message,
  createDataStream,
} from "ai";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";

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
import { getOrCreateAnonymousSession } from "@/lib/utils/session";
import { conversationCache } from "@/lib/conversation-context";
import { activeSessions, stopSession } from "@/lib/tools/browser-tool";

// Performance optimizations for streaming chat API
export const dynamic = "force-dynamic"; // Always dynamic for real-time chat
export const runtime = "nodejs"; // Use Node.js runtime for AI SDK and Redis operations
export const maxDuration = 60; // Allow streaming responses up to 60 seconds

// Create resumable stream context for handling disconnections
const streamContext = createResumableStreamContext({
  waitUntil: after,
});

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

// GET handler for resuming streams
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new Response("chatId is required", { status: 400 });
  }

  try {
    // Load stream IDs for this chat
    const { fetchQuery } = await import("convex/nextjs");
    const streamIds = await fetchQuery(api.streams.loadStreams, { chatId });

    if (!streamIds.length) {
      return new Response("No streams found", { status: 404 });
    }

    const recentStreamId = streamIds[0]; // Most recent stream

    if (!recentStreamId) {
      return new Response("No recent stream found", { status: 404 });
    }

    // Create empty data stream as fallback
    const emptyDataStream = createDataStream({
      execute: () => {},
    });

    // Try to resume the stream
    const stream = await streamContext.resumableStream(
      recentStreamId,
      () => emptyDataStream,
    );

    if (stream) {
      return new Response(stream, { status: 200 });
    }

    // If stream is completed, return the most recent message
    const messages = await fetchQuery(api.streams.getMessagesByChatId, {
      id: chatId,
    });
    const mostRecentMessage = messages[messages.length - 1];

    if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
      return new Response(emptyDataStream, { status: 200 });
    }

    // Create a stream with the completed message
    const streamWithMessage = createDataStream({
      execute: (buffer) => {
        buffer.writeData({
          type: "append-message",
          message: JSON.stringify(mostRecentMessage),
        });
      },
    });

    return new Response(streamWithMessage, { status: 200 });
  } catch (error) {
    console.error("Error resuming stream:", error);
    return new Response("Internal server error", { status: 500 });
  }
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
      bodyKeys: Object.keys(body),
      enableWebBrowsingDirect: body.enableWebBrowsing,
      optionsObject: body.options,
      fullBodyPreview: {
        ...body,
        messages: `[${body.messages?.length || 0} messages]`,
      },
    });

    const {
      messages,
      modelId = "gemini-2.0-flash" as ModelId,
      threadId: threadIdBody,
      temperature = 0.7,
      maxTokens = 2000,
      attachmentIds,
      enableWebBrowsing: directEnableWebBrowsing,
      // Extract from options object (sent by chat-input.tsx)
      options,
    } = body;

    // Get enableWebBrowsing from either direct property or options object
    const enableWebBrowsing =
      directEnableWebBrowsing ?? options?.enableWebBrowsing ?? false;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error(`[${requestId}] CHAT_API - Invalid messages:`, {
        messages,
        isArray: Array.isArray(messages),
        length: messages?.length,
      });
      return new Response(
        JSON.stringify({
          error: "Invalid request: messages array is required",
          code: "INVALID_MESSAGES",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

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
    // IMMEDIATE STREAMING OPTIMIZATION:
    // Extract session info quickly, but defer all heavy operations
    // to background processing in onFinish callback
    // ----------------------------------------------------
    let sessionId: string | null = null;
    let remainingMessages = 10; // Default for new users

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

    // QUICK rate limit check for anonymous users (non-blocking)
    if (!userId && sessionId) {
      try {
        console.log(`[${requestId}] CHAT_API - Quick rate limit check`);
        const { fetchQuery } = await import("convex/nextjs");
        const sessionStats = await fetchQuery(
          api.sessionStats.getAnonymousSessionStats,
          { sessionId },
        );

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
        remainingMessages = Math.max(0, sessionStats.remainingMessages - 1);
      } catch (error) {
        console.warn(
          `[${requestId}] CHAT_API - Rate limit check failed, proceeding:`,
          error,
        );
        // Continue with default limits if check fails
      }
    }

    // Process multimodal messages if needed
    console.log(`[${requestId}] CHAT_API - Processing multimodal messages`);
    const messagesForAI = await processMultimodalMessages(
      messages,
      attachmentIds,
      fetchOptions,
    );

    // Get tools if web browsing is enabled
    const tools = enableWebBrowsing ? getModelTools(modelId) : undefined;
    const toolChoice =
      enableWebBrowsing && tools ? ("auto" as const) : undefined;

    console.log(`[${requestId}] CHAT_API - Tool configuration:`, {
      enableWebBrowsing,
      directEnableWebBrowsing,
      optionsEnableWebBrowsing: options?.enableWebBrowsing,
      hasTools: !!tools,
      toolNames: tools ? Object.keys(tools) : [],
      toolChoice,
      modelId,
      hasBrowserbaseApiKey: !!process.env.BROWSERBASE_API_KEY,
      hasBrowserbaseProjectId: !!process.env.BROWSERBASE_PROJECT_ID,
      requestBodyKeys: Object.keys(body),
    });

    console.log(`[${requestId}] CHAT_API - Starting IMMEDIATE streamText`);

    // ------------------------------------------------------------------
    // IMMEDIATE STREAMING: Start AI response immediately
    // All database operations moved to onFinish for background processing
    // ------------------------------------------------------------------
    const result = streamText({
      model,
      messages: messagesForAI,
      temperature,
      maxTokens: Math.min(maxTokens, modelConfig.maxTokens),
      ...(tools && { tools }),
      ...(toolChoice && { toolChoice }),
      ...(tools && { maxSteps: 5 }),
      ...(tools && { experimental_toolCallStreaming: true }),

      // BACKGROUND PROCESSING: All heavy operations moved here
      async onFinish({ response, usage, finishReason }) {
        console.log(`[${requestId}] CHAT_API - Background processing started`, {
          responseMessagesCount: response.messages.length,
          usage,
          finishReason,
          responseMessages: response.messages.map((msg) => ({
            role: msg.role,
            contentType: typeof msg.content,
            contentLength:
              typeof msg.content === "string"
                ? msg.content.length
                : Array.isArray(msg.content)
                  ? msg.content.length
                  : 0,
          })),
        });

        // Background: Handle session management for anonymous users
        let finalThreadId = threadId;
        let finalSessionId = sessionId;

        if (!userId) {
          try {
            // Create/validate session in background
            if (!finalSessionId) {
              const userAgent = req.headers.get("user-agent") ?? "";
              const ip =
                req.headers.get("x-forwarded-for") ??
                req.headers.get("x-real-ip") ??
                "unknown";
              const ipHash = btoa(ip).slice(0, 16);

              const sessionData = await getOrCreateAnonymousSession(
                userAgent,
                ipHash,
              );
              finalSessionId = sessionData.sessionId;
              console.log(
                `[${requestId}] CHAT_API - Background session created:`,
                finalSessionId,
              );
            }
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Background session creation failed:`,
              error,
            );
          }
        }

        // Background: Create thread if needed
        if (!finalThreadId) {
          try {
            const lastMessage = messages[messages.length - 1];
            const smartTitle =
              typeof lastMessage?.content === "string"
                ? lastMessage.content.slice(0, 50) +
                  (lastMessage.content.length > 50 ? "..." : "")
                : "New Chat";

            if (userId) {
              finalThreadId = await fetchMutation(
                api.threads.createThread,
                {
                  title: smartTitle,
                  model: modelId,
                },
                fetchOptions,
              );
            } else {
              finalThreadId = await fetchMutation(
                api.threads.createAnonymousThread,
                {
                  sessionId: finalSessionId!,
                  title: smartTitle,
                  model: modelId,
                },
              );
            }
            console.log(
              `[${requestId}] CHAT_API - Background thread created:`,
              finalThreadId,
            );
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Background thread creation failed:`,
              error,
            );
          }
        }

        // Background: Save messages to database
        if (finalThreadId) {
          try {
            // Save user message
            const lastMessage = messages[messages.length - 1];
            if (lastMessage?.role === "user") {
              let messageId: string | undefined;

              if (userId) {
                messageId = await fetchMutation(
                  api.messages.addMessage,
                  {
                    threadId: finalThreadId as Id<"threads">,
                    content: lastMessage.content,
                    role: "user",
                  },
                  fetchOptions,
                );
              } else {
                messageId = await fetchMutation(
                  api.messages.createAnonymousMessage,
                  {
                    threadId: finalThreadId as Id<"threads">,
                    sessionId: finalSessionId!,
                    content: lastMessage.content,
                    role: "user",
                  },
                );
              }

              // Link attachments if present
              if (attachmentIds && attachmentIds.length > 0 && messageId) {
                for (const attachmentId of attachmentIds) {
                  try {
                    await fetchMutation(
                      api.attachments.linkAttachmentToThread,
                      {
                        attachmentId: attachmentId as Id<"attachments">,
                        threadId: finalThreadId as Id<"threads">,
                        messageId: messageId as Id<"messages">,
                      },
                      fetchOptions,
                    );
                  } catch (error) {
                    console.error(
                      `[${requestId}] CHAT_API - Background attachment linking failed:`,
                      error,
                    );
                  }
                }
              }
            }

            // Detect tool usage from response messages
            const toolsUsedInResponse: string[] = [];
            let hasAnyToolCalls = false;

            // Analyze response messages to detect tool usage
            for (const msg of response.messages) {
              if (msg.role === "assistant" && Array.isArray(msg.content)) {
                for (const part of msg.content) {
                  if (part.type === "tool-call") {
                    const toolCall = part as {
                      type: "tool-call";
                      toolName: string;
                    };
                    if (!toolsUsedInResponse.includes(toolCall.toolName)) {
                      toolsUsedInResponse.push(toolCall.toolName);
                    }
                    hasAnyToolCalls = true;
                  }
                }
              }
            }

            console.log(`[${requestId}] CHAT_API - Tool usage detected:`, {
              toolsUsed: toolsUsedInResponse,
              hasToolCalls: hasAnyToolCalls,
              enableWebBrowsing,
            });

            // Save AI response messages (response.messages already contains only NEW messages)
            console.log(
              `[${requestId}] CHAT_API - Processing AI response messages:`,
              {
                responseMessagesCount: response.messages.length,
                responseMessages: response.messages.map((msg) => ({
                  role: msg.role,
                  contentType: typeof msg.content,
                  hasContent: !!msg.content,
                  contentPreview:
                    typeof msg.content === "string"
                      ? msg.content.substring(0, 100) + "..."
                      : "[structured content]",
                })),
              },
            );

            for (const message of response.messages) {
              // Skip tool messages - they are internal to AI SDK and not supported by Convex schema
              if (message.role === "tool") {
                console.log(
                  `[${requestId}] CHAT_API - Skipping tool message (not supported by Convex schema)`,
                );
                continue;
              }

              // Type assertion after filtering out tool messages
              const typedMessage = message as {
                role: "assistant" | "system" | "user";
                content:
                  | string
                  | Array<{ type: string; [key: string]: unknown }>;
              };

              if (
                typedMessage.role === "assistant" ||
                typedMessage.role === "system"
              ) {
                // Extract text content from assistant/system messages
                let textContent = "";
                if (typeof typedMessage.content === "string") {
                  textContent = typedMessage.content;
                } else if (Array.isArray(typedMessage.content)) {
                  // Extract text from content parts, skip tool-call parts
                  const textParts = typedMessage.content
                    .filter((part) => part.type === "text")
                    .map((part) => (part as unknown as { text: string }).text);
                  textContent = textParts.join("");
                }

                // Skip assistant messages that are empty or only contain tool calls
                if (
                  typedMessage.role === "assistant" &&
                  (!textContent ||
                    textContent.trim() === "" ||
                    textContent.includes("[Tool Call:"))
                ) {
                  console.log(
                    `[${requestId}] CHAT_API - Skipping assistant tool call message:`,
                    { contentPreview: textContent.substring(0, 100) },
                  );
                  continue;
                }

                // Save the message to Convex with tool usage information
                if (userId) {
                  await fetchMutation(
                    api.messages.addMessage,
                    {
                      threadId: finalThreadId as Id<"threads">,
                      content: textContent,
                      role: typedMessage.role as
                        | "user"
                        | "assistant"
                        | "system",
                      model:
                        typedMessage.role === "assistant" ? modelId : undefined,
                      tokenCount:
                        typedMessage.role === "assistant"
                          ? usage?.totalTokens
                          : undefined,
                      finishReason:
                        typedMessage.role === "assistant"
                          ? finishReason
                          : undefined,
                      // Add tool usage information for assistant messages
                      toolsUsed:
                        typedMessage.role === "assistant" &&
                        toolsUsedInResponse.length > 0
                          ? toolsUsedInResponse
                          : undefined,
                      hasToolCalls:
                        typedMessage.role === "assistant"
                          ? hasAnyToolCalls
                          : undefined,
                    },
                    fetchOptions,
                  );
                } else {
                  await fetchMutation(api.messages.createAnonymousMessage, {
                    threadId: finalThreadId as Id<"threads">,
                    sessionId: finalSessionId!,
                    content: textContent,
                    role: typedMessage.role as "user" | "assistant" | "system",
                    model:
                      typedMessage.role === "assistant" ? modelId : undefined,
                    // Add tool usage information for assistant messages
                    toolsUsed:
                      typedMessage.role === "assistant" &&
                      toolsUsedInResponse.length > 0
                        ? toolsUsedInResponse
                        : undefined,
                    hasToolCalls:
                      typedMessage.role === "assistant"
                        ? hasAnyToolCalls
                        : undefined,
                  });
                }

                console.log(
                  `[${requestId}] CHAT_API - Saved ${typedMessage.role} message:`,
                  {
                    contentLength: textContent.length,
                    contentPreview: textContent.substring(0, 100) + "...",
                    tokenCount: usage?.totalTokens || 0,
                    toolsUsed:
                      typedMessage.role === "assistant"
                        ? toolsUsedInResponse
                        : undefined,
                    hasToolCalls:
                      typedMessage.role === "assistant"
                        ? hasAnyToolCalls
                        : undefined,
                  },
                );
              }
            }
            console.log(
              `[${requestId}] CHAT_API - Background message saving completed`,
            );
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Background message saving failed:`,
              error,
            );
          }
        }

        // Background: Cache conversation context
        if (finalThreadId) {
          try {
            const conversationMessage = {
              role: "user" as const,
              content: messages[messages.length - 1]?.content || "",
              timestamp: Date.now(),
              model: modelId,
              messageId: `user-${Date.now()}`,
            };
            await conversationCache.appendMessage(
              finalThreadId,
              conversationMessage,
            );
            console.log(
              `[${requestId}] CHAT_API - Background caching completed`,
            );
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Background caching failed:`,
              error,
            );
          }
        }

        // Background: Track usage for authenticated users
        if (userId && usage) {
          try {
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
            console.log(
              `[${requestId}] CHAT_API - Background usage tracking completed`,
            );
          } catch (error) {
            console.error(
              `[${requestId}] CHAT_API - Background usage tracking failed:`,
              error,
            );
          }
        }

        // Background: Cleanup browser sessions
        try {
          if (activeSessions.size > 0) {
            for (const id of Array.from(activeSessions)) {
              await stopSession(id);
              activeSessions.delete(id);
            }
          }
        } catch (error) {
          console.warn(
            `[${requestId}] CHAT_API - Background session cleanup failed:`,
            error,
          );
        }

        console.log(
          `[${requestId}] CHAT_API - All background processing completed`,
        );
      },

      onError: (error) => {
        console.error(`[${requestId}] CHAT_API - streamText onError:`, error);
      },
    });

    console.log(
      `[${requestId}] CHAT_API - Returning stream response for provider:`,
      modelConfig.provider,
    );

    // Use different streaming approach based on provider
    // Groq works better with toTextStreamResponse() due to buffering issues
    if (modelConfig.provider === "groq") {
      console.log(`[${requestId}] CHAT_API - Using text stream for Groq`);
      return result.toTextStreamResponse({
        headers: {
          // Essential headers for Groq streaming
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Connection: "keep-alive",
          "Transfer-Encoding": "chunked",
          "X-Accel-Buffering": "no",
          "Content-Encoding": "none",

          // Rate limiting headers for anonymous users
          ...(!userId && {
            "X-RateLimit-Remaining": remainingMessages.toString(),
            "X-RateLimit-Limit": "10",
          }),
        },
      });
    }

    // Use data stream for other providers (Gemini, OpenAI)
    return result.toDataStreamResponse({
      headers: {
        // Performance headers for immediate streaming
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Connection: "keep-alive",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no", // Disable proxy buffering
        "Content-Encoding": "none", // Prevent compression issues

        // Rate limiting headers for anonymous users
        ...(!userId && {
          "X-RateLimit-Remaining": remainingMessages.toString(),
          "X-RateLimit-Limit": "10",
        }),
      },
    });
  } catch (error) {
    console.error(`[${requestId}] CHAT_API - Request failed:`, error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
