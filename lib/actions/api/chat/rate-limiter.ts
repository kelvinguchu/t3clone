import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { checkRateLimit } from "@/lib/utils/session";

export interface RateLimitResult {
  allowed: boolean;
  remainingMessages: number;
  errorMessage?: string;
  trustLevel?: string;
}

// Enhanced rate limiting for anonymous users using multi-factor analysis
export async function checkAnonymousRateLimit(
  userId: string | null,
  sessionId: string | null,
): Promise<RateLimitResult> {
  // Authenticated users have different (higher) limits
  if (userId) {
    return {
      allowed: true,
      remainingMessages: 1000, // High number for authenticated users
      trustLevel: "AUTHENTICATED",
    };
  }

  // Anonymous users need session-based rate limiting
  if (!sessionId) {
    return {
      allowed: false,
      remainingMessages: 0,
      errorMessage: "Session required for anonymous users",
      trustLevel: "NONE",
    };
  }

  try {
    // Use the new multi-factor rate limiting system
    const rateLimitCheck = await checkRateLimit(sessionId);

    if (!rateLimitCheck.allowed) {
      return {
        allowed: false,
        remainingMessages: 0,
        errorMessage: rateLimitCheck.reason || "Rate limit exceeded",
        trustLevel: rateLimitCheck.trustLevel,
      };
    }

    // Get session stats from Convex for remaining message count
    const sessionStats = await fetchQuery(
      api.sessionStats.getAnonymousSessionStats,
      { sessionId },
    );

    if (sessionStats.remainingMessages <= 0) {
      return {
        allowed: false,
        remainingMessages: 0,
        errorMessage: "Message limit exceeded. Please sign up to continue.",
        trustLevel: rateLimitCheck.trustLevel,
      };
    }

    const remainingMessages = Math.max(0, sessionStats.remainingMessages - 1);

    return {
      allowed: true,
      remainingMessages,
      trustLevel: rateLimitCheck.trustLevel,
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
      trustLevel: "NEW", // Default to lowest trust level
    };
  }
}
