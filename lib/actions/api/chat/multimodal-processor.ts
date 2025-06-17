import { convertToCoreMessages, type CoreMessage, type Message } from "ai";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

/**
 * Processes messages and attachments to convert them to multimodal format
 * Handles both experimental_attachments (from AI SDK) and legacy attachmentIds
 */
export async function processMultimodalMessages(
  messages: Message[],
  attachmentIds?: string[],
  fetchOptions?: { token: string },
): Promise<CoreMessage[]> {
  const coreMessages = convertToCoreMessages(messages);

  // Check if messages already have experimental_attachments (from AI SDK)
  const hasExperimentalAttachments = messages.some((msg) => {
    const attachments = (msg as { experimental_attachments?: unknown[] })
      .experimental_attachments;
    return attachments && attachments.length > 0;
  });

  // If messages have experimental_attachments, process them
  if (hasExperimentalAttachments) {
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
        for (const attachmentId of attachmentIds) {
          try {
            const attachment = await fetchQuery(
              api.attachments.getAttachment,
              { attachmentId: attachmentId as Id<"attachments"> },
              fetchOptions,
            );

            if (!attachment) {
              continue;
            }

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
        lastMessage.content = multimodalContent;
      }
    }
  }

  return coreMessages;
}
