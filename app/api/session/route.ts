import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  getAnonymousSession,
  updateAnonymousSession,
  incrementSessionMessageCount,
  deleteAnonymousSession,
  hashIP,
  type AnonymousSessionData,
  getOrCreateAnonymousSession,
} from "@/lib/utils/session";

// GET /api/session - Get or create anonymous session
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    // Session ID can come from query param, cookie, or header
    const cookiesStore = await cookies();
    const cookieSessionId = cookiesStore.get("anon_session_id")?.value;

    const sessionId =
      searchParams.get("sessionId") ?? cookieSessionId ?? undefined;

    // Get client info for session creation
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") ?? "unknown";
    const forwarded = headersList.get("x-forwarded-for") ?? "unknown";
    const realIp = headersList.get("x-real-ip") ?? "unknown";
    const ip = forwarded.split(",")[0] ?? realIp ?? "unknown";
    const ipHash = hashIP(ip);

    let sessionData: AnonymousSessionData;

    if (sessionId) {
      // Try to get existing session
      const existingSession = await getAnonymousSession(sessionId);
      if (existingSession) {
        sessionData = existingSession;
      } else {
        // Fallback: attempt fingerprint lookup or create new
        sessionData = await getOrCreateAnonymousSession(userAgent, ipHash);
      }
    } else {
      // No session ID provided, do fingerprint lookup or create new
      sessionData = await getOrCreateAnonymousSession(userAgent, ipHash);
    }

    // Always refresh the cookie so it stays valid for the full TTL window
    const response = NextResponse.json(sessionData);
    response.cookies.set("anon_session_id", sessionData.sessionId, {
      httpOnly: false, // readable by browser JS so hooks can still use localStorage fallback
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24h
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error in session API:", error);
    return NextResponse.json(
      { error: "Failed to manage session" },
      { status: 500 },
    );
  }
}

// POST /api/session/increment - Increment message count
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    const updatedSession = await incrementSessionMessageCount(sessionId);

    if (!updatedSession) {
      return NextResponse.json(
        { error: "Session not found or expired" },
        { status: 404 },
      );
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Error incrementing message count:", error);

    if (
      error instanceof Error &&
      error.message.includes("Message limit exceeded")
    ) {
      return NextResponse.json(
        { error: "Message limit exceeded" },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Failed to increment message count" },
      { status: 500 },
    );
  }
}

// PUT /api/session - Update session
export async function PUT(request: NextRequest) {
  try {
    const sessionData: AnonymousSessionData = await request.json();

    if (!sessionData.sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    await updateAnonymousSession(sessionData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 },
    );
  }
}

// DELETE /api/session - Delete session
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    await deleteAnonymousSession(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 },
    );
  }
}
