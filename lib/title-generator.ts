import { generateText } from "ai";
import { getModel } from "@/lib/ai-providers";

/**
 * Generate a meaningful thread title using AI from user input or AI response
 * This function should only be called server-side (in API routes)
 */
export async function generateThreadTitle(
  text: string,
  maxLength = 50,
): Promise<string> {
  if (!text || text.trim().length === 0) return "New Chat";

  // Clean the text for processing
  const cleaned = text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`([^`]*)`/g, "$1") // Remove inline code
    .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
    .replace(/\*(.*?)\*/g, "$1") // Remove italic markdown
    .replace(/#{1,6}\s+/g, "") // Remove markdown headers
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // If it's just one word or very short, keep "New Chat"
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 1 || cleaned.length < 10) {
    return "New Chat";
  }

  try {
    // Use AI to generate a smart title
    const model = await getModel("llama3-70b-8192");

    const result = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: `You are a title generator. Create a concise, meaningful title (max ${maxLength} characters) for a conversation based on the given text. 

Rules:
- Keep it under ${maxLength} characters
- Make it descriptive and specific
- If it's a question, preserve the question format
- If it's a request/command, make it action-oriented
- Don't use quotes around the title
- Just return the title, nothing else

Examples:
- "How do I implement authentication?" → "How do I implement authentication?"
- "Write a Python function to sort data" → "Python function to sort data"
- "Explain quantum computing concepts" → "Explain quantum computing"
- "Help me debug this React component" → "Debug React component"`,
        },
        {
          role: "user",
          content: `Generate a title for this text: "${cleaned}"`,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent titles
      maxTokens: 50,
    });

    const aiTitle = result.text
      .trim()
      .replace(/^["']|["']$/g, "") // Remove surrounding quotes
      .replace(/\n+/g, " ") // Remove newlines
      .trim();

    // Validate the AI-generated title
    if (aiTitle && aiTitle.length <= maxLength && aiTitle.length > 3) {
      return aiTitle;
    }

    // Fallback: use first part of cleaned text if AI fails
    return cleaned.length <= maxLength
      ? cleaned
      : cleaned.slice(0, maxLength - 3) + "...";
  } catch (error) {
    console.warn("AI title generation failed, using fallback:", error);

    // Fallback: use first meaningful part of the text
    return cleaned.length <= maxLength
      ? cleaned
      : cleaned.slice(0, maxLength - 3) + "...";
  }
}

/**
 * Client-side helper to generate thread title via API route
 * Use this function from React components/hooks
 */
export async function generateThreadTitleClient(
  text: string,
  maxLength = 50,
): Promise<string> {
  try {
    const response = await fetch("/api/title-generation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, maxLength }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { title } = await response.json();
    return title;
  } catch (error) {
    console.warn("Client-side title generation failed, using fallback:", error);

    // Fallback: use simple title generation
    return generateSimpleTitle(text, maxLength);
  }
}

/**
 * Check if a title should be auto-updated (is it still the default)
 */
export function shouldUpdateTitle(currentTitle: string): boolean {
  const defaultTitles = ["New Chat", "new chat", "New chat", "NEW CHAT"];
  return defaultTitles.includes(currentTitle.trim());
}

/**
 * Fallback title generation (no AI, for performance)
 */
export function generateSimpleTitle(text: string, maxLength = 50): string {
  if (!text || text.trim().length === 0) return "New Chat";

  const cleaned = text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`([^`]*)`/g, "$1") // Remove inline code
    .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown
    .replace(/\*(.*?)\*/g, "$1") // Remove italic markdown
    .replace(/#{1,6}\s+/g, "") // Remove markdown headers
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // If it's just one word or very short, keep "New Chat"
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 1 || cleaned.length < 10) {
    return "New Chat";
  }

  return cleaned.length <= maxLength
    ? cleaned
    : cleaned.slice(0, maxLength - 3) + "...";
}
