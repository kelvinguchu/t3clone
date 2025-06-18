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
  generateFingerprintHash,
  type BrowserFingerprint,
} from "@/lib/utils/session";

// GET /api/session - Get or create anonymous session
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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

    // Try to get browser fingerprint from request body (for POST-like behavior)
    let fingerprintHash: string | undefined;
    const fingerprintParam = searchParams.get("fingerprint");
    if (fingerprintParam) {
      try {
        const fingerprint: BrowserFingerprint = JSON.parse(
          decodeURIComponent(fingerprintParam),
        );
        fingerprintHash = generateFingerprintHash(fingerprint);
      } catch {
        // Invalid fingerprint data, continue without it
        console.warn("Invalid fingerprint data received");
      }
    }

    let sessionData: AnonymousSessionData;

    if (sessionId) {
      // Try to get existing session
      const existingSession = await getAnonymousSession(sessionId);
      if (existingSession) {
        sessionData = existingSession;
      } else {
        // Fallback: attempt fingerprint lookup or create new
        sessionData = await getOrCreateAnonymousSession(
          userAgent,
          ipHash,
          fingerprintHash,
        );
      }
    } else {
      // No session ID provided, do fingerprint lookup or create new
      sessionData = await getOrCreateAnonymousSession(
        userAgent,
        ipHash,
        fingerprintHash,
      );
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

// POST /api/session - Create/update session with fingerprint data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, fingerprint } = body;

    // Get client info
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") ?? "unknown";
    const forwarded = headersList.get("x-forwarded-for") ?? "unknown";
    const realIp = headersList.get("x-real-ip") ?? "unknown";
    const ip = forwarded.split(",")[0] ?? realIp ?? "unknown";
    const ipHash = hashIP(ip);

    // Generate fingerprint hash if provided
    let fingerprintHash: string | undefined;
    if (fingerprint) {
      try {
        fingerprintHash = generateFingerprintHash(
          fingerprint as BrowserFingerprint,
        );
      } catch {
        console.warn("Invalid fingerprint data in POST request");
      }
    }

    let sessionData: AnonymousSessionData;

    if (sessionId) {
      // Try to get existing session and update it
      const existingSession = await getAnonymousSession(sessionId);
      if (existingSession) {
        // Update fingerprint if provided
        if (fingerprintHash) {
          existingSession.fingerprintHash = fingerprintHash;
          existingSession.lastFingerprintUpdate = Date.now();
        }
        await updateAnonymousSession(existingSession);
        sessionData = existingSession;
      } else {
        // Session not found, create new one
        sessionData = await getOrCreateAnonymousSession(
          userAgent,
          ipHash,
          fingerprintHash,
        );
      }
    } else {
      // Create new session
      sessionData = await getOrCreateAnonymousSession(
        userAgent,
        ipHash,
        fingerprintHash,
      );
    }

    // Set cookie for the session
    const response = NextResponse.json(sessionData);
    response.cookies.set("anon_session_id", sessionData.sessionId, {
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24h
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Error in session POST API:", error);
    return NextResponse.json(
      { error: "Failed to create/update session" },
      { status: 500 },
    );
  }
}

// PUT /api/session/increment - Increment message count
export async function PUT(request: NextRequest) {
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

// PATCH /api/session - Update session
export async function PATCH(request: NextRequest) {
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
