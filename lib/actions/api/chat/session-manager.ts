import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  getOrCreateAnonymousSession,
  getAnonymousSession,
  hashIP,
} from "@/lib/utils/session";

export interface SessionInfo {
  sessionId: string | null;
  remainingMessages: number;
  ipHash: string | null;
}

// Extract session ID from headers and cookies, create anonymous session if needed
export async function resolveSessionInfo(
  req: NextRequest,
  userId: string | null,
): Promise<SessionInfo> {
  if (userId) {
    return { sessionId: null, remainingMessages: 10, ipHash: null };
  }

  const sessionId =
    req.headers.get("x-session-id") ??
    req.headers.get("X-Session-ID") ??
    (await cookies()).get("anon_session_id")?.value ??
    null;

  let sessionData;

  if (sessionId) {
    try {
      sessionData = await getAnonymousSession(sessionId);
    } catch (error) {
      console.error(
        `[resolveSessionInfo] Failed to get session ${sessionId}, creating a new one.`,
        error,
      );
      sessionData = undefined;
    }
  }

  if (!sessionData || sessionData.isExpired) {
    const ip =
      req.headers.get("x-forwarded-for") ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const ipHash = hashIP(ip);
    const userAgent = req.headers.get("user-agent") ?? "";
    try {
      sessionData = await getOrCreateAnonymousSession(userAgent, ipHash);
    } catch (error) {
      console.error(
        "[resolveSessionInfo] Session creation/retrieval failed:",
        error,
      );
      // Return a default state if session handling completely fails
      return { sessionId: null, remainingMessages: 0, ipHash: null };
    }
  }

  return {
    sessionId: sessionData.sessionId,
    remainingMessages: sessionData.remainingMessages,
    ipHash: sessionData.ipHash,
  };
}
