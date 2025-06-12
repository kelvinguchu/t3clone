import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateAnonymousSession,
  getAnonymousSession,
  incrementSessionMessageCount,
  hashIP,
} from "@/lib/utils/session";
import {
  anonymousMessageLimit,
  anonymousMinuteLimit,
  anonymousSecondLimit,
} from "@/lib/rate-limit";

// Get client IP address safely
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const remoteAddr = request.headers.get("x-vercel-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (remoteAddr) {
    return remoteAddr;
  }

  return "unknown";
}

// POST /api/anonymous - Create or get anonymous session
export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const ipHash = hashIP(clientIP);

    // Rate limiting by IP
    const rateLimitChecks = await Promise.all([
      anonymousSecondLimit.limit(ipHash),
      anonymousMinuteLimit.limit(ipHash),
    ]);

    // Check if any rate limit is exceeded
    const rateLimitExceeded = rateLimitChecks.some((result) => !result.success);
    if (rateLimitExceeded) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please slow down.",
          rateLimitExceeded: true,
        },
        { status: 429 },
      );
    }

    // Create or get session
    const sessionData = await getOrCreateAnonymousSession(userAgent, ipHash);

    return NextResponse.json({
      sessionData,
      success: true,
    });
  } catch (error) {
    console.error("Error in anonymous session creation:", error);
    return NextResponse.json(
      { error: "Failed to create anonymous session" },
      { status: 500 },
    );
  }
}

// GET /api/anonymous?sessionId=xxx - Get session status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    // Get session from KV
    const sessionData = await getAnonymousSession(sessionId);

    if (!sessionData) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      sessionData,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching anonymous session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 },
    );
  }
}

// PATCH /api/anonymous - Increment message count
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    const clientIP = getClientIP(request);
    const ipHash = hashIP(clientIP);

    // Multi-layer rate limiting
    const rateLimitChecks = await Promise.all([
      anonymousSecondLimit.limit(sessionId),
      anonymousMinuteLimit.limit(sessionId),
      anonymousMessageLimit.limit(sessionId),
      // Also limit by IP as backup
      anonymousSecondLimit.limit(ipHash),
      anonymousMinuteLimit.limit(ipHash),
    ]);

    // Check if any rate limit is exceeded
    const rateLimitExceeded = rateLimitChecks.some((result) => !result.success);
    if (rateLimitExceeded) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please slow down.",
          rateLimitExceeded: true,
        },
        { status: 429 },
      );
    }

    // Increment message count
    const updatedSession = await incrementSessionMessageCount(sessionId);

    if (!updatedSession) {
      return NextResponse.json(
        { error: "Session not found or message limit exceeded" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      sessionData: updatedSession,
      success: true,
    });
  } catch (error) {
    console.error("Error incrementing message count:", error);

    if (
      error instanceof Error &&
      error.message.includes("Message limit exceeded")
    ) {
      return NextResponse.json(
        {
          error:
            "Daily message limit reached. Please sign up for unlimited messaging.",
          limitExceeded: true,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Failed to increment message count" },
      { status: 500 },
    );
  }
}
