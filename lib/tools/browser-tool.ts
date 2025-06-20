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

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[createSession] API Error:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    throw new Error(
      `Browserbase API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data = await response.json();
  return { id: data.id, debugUrl: data.debugUrl };
}

export const activeSessions = new Set<string>();

interface ActiveSession {
  id: string;
  connectUrl: string;
}

let currentSession: ActiveSession | null = null;

export async function stopSession(sessionId: string) {
  try {
    await fetch(`https://www.browserbase.com/v1/sessions/${sessionId}`, {
      method: "POST",
      headers: {
        "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "REQUEST_RELEASE",
        projectId: process.env.BROWSERBASE_PROJECT_ID,
      }),
    });
  } catch (err) {
    console.warn("[browser-tool] Failed to stop session", err);
  }
  if (currentSession?.id === sessionId) {
    currentSession = null;
  }
}

// Create Session Tool
export const createSessionTool = tool({
  description:
    "Create a new browser session (internal). The returned sessionId and debugUrl are meant for subsequent tool calls ONLY and must NOT be revealed to the end user.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const session = await createSession();
      activeSessions.add(session.id);
      return {
        toolName: "Browser session ready",
        success: true,
      };
    } catch (error) {
      console.error("[createSessionTool] Failed to create session:", error);
      return {
        sessionId: null,
        debugUrl: null,
        toolName: "Failed to create session",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

// After activeSessions set
async function ensureActiveSession(): Promise<ActiveSession> {
  if (currentSession) return currentSession;

  const session = await createSession();
  const debugInfo = await getDebugUrl(session.id);
  const connectUrl: string = debugInfo.wsUrl;

  currentSession = { id: session.id, connectUrl };
  activeSessions.add(session.id);
  return currentSession;
}

async function connectBrowser(retries = 5) {
  const { chromium } = await import("playwright-core");
  const { connectUrl } = await ensureActiveSession();
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await chromium.connectOverCDP(connectUrl);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastError;
}

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
  execute: async ({ query, modelId }) => {
    try {
      const { generateText } = await import("ai");

      const browser = await connectBrowser();
      const defaultContext = browser.contexts()[0];
      const page = defaultContext.pages()[0];

      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      );
      await page.waitForTimeout(500);
      await page.keyboard.press("Enter");
      await page.waitForLoadState("load", { timeout: 8000 });

      try {
        await page.waitForSelector(".g", { timeout: 8000 });
      } catch {
        console.warn(
          "[googleSearchTool] .g selector did not appear - continuing with fallback scraping",
        );
      }

      const results = await page.evaluate(() => {
        const items = document.querySelectorAll(".g");
        return Array.from(items).map((item: Element) => {
          const title = item.querySelector("h3")?.textContent || "";
          const description = item.querySelector(".VwiC3b")?.textContent || "";
          const linkEl = item.querySelector("a");
          const url = linkEl ? (linkEl as HTMLAnchorElement).href : "";
          const domain = url ? new URL(url).hostname.replace("www.", "") : "";
          return { title, description, url, domain };
        });
      });

      const text = results
        .map(
          (item: { title: string; description: string; url: string }) =>
            `${item.title}\n${item.description}\nURL: ${item.url}`,
        )
        .join("\n\n");

      const evaluationModelId: ModelId =
        (modelId as ModelId) || "llama3-70b-8192";
      const model = await getModel(evaluationModelId);

      const response = await generateText({
        model,
        prompt: `Using the Google search snippets below, write an informative answer **in 6-8 bullet points**. Requirements:
• Capture one key fact or finding.
• End each bullet with the direct URL in parentheses.
• Avoid fluff; focus on concrete data, names, dates, figures, or direct quotes.
• Do mention that you performed a web search or but do not mention which tool/service was used.

Google snippets:\n\n${text}`,
      });

      await browser.close();

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

// DuckDuckGo Search Tool
export const duckDuckGoSearchTool = tool({
  description: "Search DuckDuckGo for a query",
  parameters: z.object({
    toolName: z.string().describe("What the tool is doing"),
    query: z.string().describe("The exact search query provided by the user."),
    modelId: z.optional(z.string()),
  }),
  execute: async ({ query, modelId }) => {
    try {
      const { generateText } = await import("ai");

      const browser = await connectBrowser();
      const defaultContext = browser.contexts()[0];
      const page = defaultContext.pages()[0];

      await page.goto(
        `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          waitUntil: "load",
          timeout: 10000,
        },
      );

      await page.waitForSelector("a.result__a", { timeout: 7000 });

      const results = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a.result__a"))
          .slice(0, 10)
          .map((a) => {
            const title = (a as HTMLElement).innerText;
            const url = (a as HTMLAnchorElement).href;
            const source = new URL(url).hostname.replace("www.", "");
            const parent = a.closest(".result");
            const snippet =
              (parent?.querySelector(".result__snippet") as HTMLElement | null)
                ?.innerText || "";
            return { title, source, url, snippet };
          });
      });

      const text = results
        .map((r) => `${r.title}\nSource: ${r.source}\n${r.snippet}`)
        .join("\n\n");

      const evaluationModelId: ModelId =
        (modelId as ModelId) || "llama3-70b-8192";
      const model = await getModel(evaluationModelId);

      const summary = await generateText({
        model,
        prompt: `Using the DuckDuckGo top-10 search snippets below, craft a detailed answer in 6-8 bullet points. Requirements:
• Each bullet begins with the headline, followed by a two-sentence explanation of the key information it contributes.
• End each bullet with the direct URL in parentheses.
• No generic filler; include dates, numbers, or named entities whenever present.
• Do mention that you performed a web search or but do not mention which tool/service was used.

DuckDuckGo snippets:\n\n${text}`,
      });

      await browser.close();

      return {
        toolName: "DuckDuckGo Search",
        content: summary.text,
        dataCollected: true,
      };
    } catch (error) {
      console.error("Error in duckDuckGoSearchTool", error);
      return {
        toolName: "DuckDuckGo Search",
        content: `Error: ${error}`,
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
      .optional(z.string())
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
      const { generateText } = await import("ai");
      const { Readability } = await import("@mozilla/readability");
      const { JSDOM } = await import("jsdom");

      if (!sessionId) {
        sessionId = Array.from(activeSessions).pop() as string;
      }

      const browser = await connectBrowser();
      const defaultContext = browser.contexts()[0];
      const page = defaultContext.pages()[0];

      await page.goto(url);

      const content = await page.content();
      const dom = new JSDOM(content);
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      const text = `${article?.title || ""}\n${article?.textContent || ""}`;

      const evaluationModelId: ModelId =
        (modelId as ModelId) || "llama3-70b-8192";
      const model = await getModel(evaluationModelId);

      const response = await generateText({
        model,
        prompt: `Summarise the following article in 3-4 concise bullet points suitable for a news briefing. Article text:\n\n${text}`,
      });

      await browser.close();

      return {
        toolName: "Getting Page Content",
        content: response.text,
        dataCollected: true,
      };
    } catch (error) {
      console.error("Error in getPageContent:", error);
      return {
        toolName: "Getting Page Content",
        content: `Error getting page content: ${error}`,
        dataCollected: false,
      };
    }
  },
});
