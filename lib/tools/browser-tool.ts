import { z } from "zod";
import { tool } from "ai";
import { getModel, type ModelId } from "@/lib/ai-providers";

// Helper functions
async function getDebugUrl(id: string) {
  const response = await fetch(
    `https://www.browserbase.com/v1/sessions/${id}/debug`,
    {
      method: "GET",
      headers: {
        "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
        "Content-Type": "application/json",
      },
    },
  );
  const data = await response.json();
  return data;
}

async function createSession() {
  const response = await fetch(`https://www.browserbase.com/v1/sessions`, {
    method: "POST",
    headers: {
      "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      keepAlive: true,
    }),
  });
  const data = await response.json();
  return { id: data.id, debugUrl: data.debugUrl };
}

// Create Session Tool
export const createSessionTool = tool({
  description: "Create a new browser session",
  parameters: z.object({}),
  execute: async () => {
    const session = await createSession();
    const debugUrl = await getDebugUrl(session.id);
    return {
      sessionId: session.id,
      debugUrl: debugUrl.debuggerFullscreenUrl,
      toolName: "Creating a new session",
    };
  },
});

// Google Search Tool
export const googleSearchTool = tool({
  description: "Search Google for a query",
  parameters: z.object({
    toolName: z.string().describe("What the tool is doing"),
    query: z
      .string()
      .describe(
        "The exact and complete search query as provided by the user. Do not modify this in any way.",
      ),
    sessionId: z
      .string()
      .describe(
        "The session ID to use for the search. If there is no session ID, create a new session with createSession Tool.",
      ),
    debuggerFullscreenUrl: z
      .string()
      .describe(
        "The fullscreen debug URL to use for the search. If there is no debug URL, create a new session with createSession Tool.",
      ),
    modelId: z
      .optional(z.string())
      .describe(
        "(Optional) The ID of the model currently being used in the conversation. If omitted, a default model will be used.",
      ),
  }),
  execute: async ({ query, sessionId, modelId }) => {
    try {
      const { chromium } = await import("playwright-core");
      const { generateText } = await import("ai");

      const browser = await chromium.connectOverCDP(
        `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`,
      );
      const defaultContext = browser.contexts()[0];
      const page = defaultContext.pages()[0];

      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      );
      await page.waitForTimeout(500);
      await page.keyboard.press("Enter");
      await page.waitForLoadState("load", { timeout: 10000 });

      await page.waitForSelector(".g");

      const results = await page.evaluate(() => {
        const items = document.querySelectorAll(".g");
        return Array.from(items).map((item: Element) => {
          const title = item.querySelector("h3")?.textContent || "";
          const description = item.querySelector(".VwiC3b")?.textContent || "";
          return { title, description };
        });
      });

      const text = results
        .map(
          (item: { title: string; description: string }) =>
            `${item.title}\n${item.description}`,
        )
        .join("\n\n");

      const evaluationModelId: ModelId = (modelId as ModelId) || "gpt-4.1-mini";
      const model = getModel(evaluationModelId);

      const response = await generateText({
        model,
        prompt: `Evaluate the following web page content: ${text}`,
      });

      return {
        toolName: "Searching Google",
        content: response.text,
        dataCollected: true,
      };
    } catch (error) {
      console.error("Error in googleSearch:", error);
      return {
        toolName: "Searching Google",
        content: `Error performing Google search: ${error}`,
        dataCollected: false,
      };
    }
  },
});

// Get Page Content Tool
export const getPageContentTool = tool({
  description: "Get the content of a page using Playwright",
  parameters: z.object({
    toolName: z.string().describe("What the tool is doing"),
    url: z.string().describe("The url to get the content of"),
    sessionId: z
      .string()
      .describe(
        "The session ID to use for the search. If there is no session ID, create a new session with createSession Tool.",
      ),
    debuggerFullscreenUrl: z
      .string()
      .describe(
        "The fullscreen debug URL to use for the search. If there is no debug URL, create a new session with createSession Tool.",
      ),
    modelId: z
      .optional(z.string())
      .describe(
        "(Optional) The ID of the model currently being used in the conversation. If omitted, a default model will be used.",
      ),
  }),
  execute: async ({ url, sessionId, modelId }) => {
    try {
      const { chromium } = await import("playwright-core");
      const { generateText } = await import("ai");
      const { Readability } = await import("@mozilla/readability");
      const { JSDOM } = await import("jsdom");

      const browser = await chromium.connectOverCDP(
        `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`,
      );
      const defaultContext = browser.contexts()[0];
      const page = defaultContext.pages()[0];

      await page.goto(url);

      const content = await page.content();
      const dom = new JSDOM(content);
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      const text = `${article?.title || ""}\n${article?.textContent || ""}`;

      const evaluationModelId: ModelId = (modelId as ModelId) || "gpt-4.1-mini";
      const model = getModel(evaluationModelId);

      const response = await generateText({
        model,
        prompt: `Evaluate the following web page content: ${text}`,
      });

      return {
        toolName: "Getting page content",
        content: response.text,
      };
    } catch (error) {
      console.error("Error in getPageContent:", error);
      return {
        toolName: "Getting page content",
        content: `Error fetching page content: ${error}`,
      };
    }
  },
});

// Ask for Confirmation Tool
export const askForConfirmationTool = tool({
  description: "Ask the user for confirmation.",
  parameters: z.object({
    message: z.string().describe("The message to ask for confirmation."),
  }),
});

// Main browser tool (for backward compatibility)
export const browserTool = createSessionTool;
