import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getOrCreateAnonymousSession } from "@/lib/utils/session";

export interface SessionInfo {
  sessionId: string | null;
  remainingMessages: number;
}

// Extract session ID from headers and cookies, create anonymous session if needed
export async function resolveSessionInfo(
  req: NextRequest,
  userId: string | null,
): Promise<SessionInfo> {
  let sessionId: string | null = null;
  let remainingMessages = 10; // Default for new users

  const headerSessionId =
    req.headers.get("x-session-id") ?? req.headers.get("X-Session-ID");
  const cookieSessionId = (await cookies()).get("anon_session_id")?.value;
  sessionId = headerSessionId ?? cookieSessionId ?? null;

  // For anonymous users, create or get session
  if (!userId) {
    try {
      if (!sessionId) {
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
        sessionId = sessionData.sessionId;
        remainingMessages = sessionData.remainingMessages;
      }
    } catch (error) {
      console.error(`[resolveSessionInfo] Session creation failed:`, error);
    }
  }

  return {
    sessionId,
    remainingMessages,
  };
}
