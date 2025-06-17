import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export interface RateLimitResult {
  allowed: boolean;
  remainingMessages: number;
  errorMessage?: string;
}

// Check rate limits for anonymous users
export async function checkAnonymousRateLimit(
  userId: string | null,
  sessionId: string | null,
): Promise<RateLimitResult> {
  // Authenticated users have different (higher) limits
  if (userId) {
    return {
      allowed: true,
      remainingMessages: 1000, // High number for authenticated users
    };
  }

  // Anonymous users need session-based rate limiting
  if (!sessionId) {
    return {
      allowed: false,
      remainingMessages: 0,
      errorMessage: "Session required for anonymous users",
    };
  }

  try {
    const sessionStats = await fetchQuery(
      api.sessionStats.getAnonymousSessionStats,
      { sessionId },
    );

    if (sessionStats.remainingMessages <= 0) {
      return {
        allowed: false,
        remainingMessages: 0,
        errorMessage: "Message limit exceeded. Please sign up to continue.",
      };
    }

    const remainingMessages = Math.max(0, sessionStats.remainingMessages - 1);

    return {
      allowed: true,
      remainingMessages,
    };
  } catch (error) {
    console.warn(
      `[checkAnonymousRateLimit] Rate limit check failed, allowing request:`,
      error,
    );

    // If rate limit check fails, allow the request but with conservative limits
    return {
      allowed: true,
      remainingMessages: 5, // Conservative fallback
    };
  }
}
