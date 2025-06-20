import { NextRequest, NextResponse } from "next/server";
import {
  getAnonymousSession,
  updateAnonymousSession,
  deleteAnonymousSession,
  getOrCreateAnonymousSession,
  mergeAnonymousSessions,
} from "@/lib/utils/session";
import { getAuth } from "@clerk/nextjs/server";

// GET /api/session - Get or create anonymous session OR check authenticated user status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  // If sessionId is provided, just fetch that session
  if (sessionId) {
    try {
      const session = await getAnonymousSession(sessionId);
      if (session) {
        return NextResponse.json(session);
      }
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    } catch (error) {
      console.error("Error fetching session:", error);
      return NextResponse.json(
        { error: "Failed to fetch session" },
        { status: 500 },
      );
    }
  }

  // No sessionId provided – create or fetch using IP (anonymous bootstrap)
  try {
    const clientIp = (request.headers.get("x-forwarded-for") ?? "127.0.0.1")
      .split(",")[0]
      .trim();
    const session = await getOrCreateAnonymousSession(undefined, clientIp);
    return NextResponse.json(session);
  } catch (error) {
    console.error("Error creating anonymous session:", error);
    return NextResponse.json(
      { error: "Failed to create anonymous session" },
      { status: 500 },
    );
  }
}

// POST /api/session - Create/update session with fingerprint data OR merge two sessions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === "merge") {
      const { fromSessionId, toSessionId } = body;
      if (!fromSessionId || !toSessionId) {
        return NextResponse.json(
          {
            error: "Both fromSessionId and toSessionId are required for merge",
          },
          { status: 400 },
        );
      }
      const mergedSession = await mergeAnonymousSessions(
        fromSessionId,
        toSessionId,
      );
      if (!mergedSession) {
        return NextResponse.json(
          { error: "Session merge failed. One of the sessions may not exist." },
          { status: 404 },
        );
      }
      return NextResponse.json(mergedSession);
    }

    const { sessionId, fingerprint } = body;
    const { userId } = getAuth(request);

    if (!userId && !fingerprint && !sessionId) {
      return NextResponse.json(
        { error: "Session ID or fingerprint is required for anonymous users" },
        { status: 400 },
      );
    }

    const clientIp = (request.headers.get("x-forwarded-for") ?? "127.0.0.1")
      .split(",")[0]
      .trim();
    const sessionData = await getOrCreateAnonymousSession(
      sessionId,
      clientIp,
      fingerprint,
    );

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error("Error handling POST /api/session:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to process session", details: errorMessage },
      { status: 500 },
    );
  }
}

// PUT /api/session - Update message count for a session
export async function PUT(request: NextRequest) {
  try {
    const { sessionId, messageCount } = await request.json();
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    const session = await getAnonymousSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    session.messageCount = messageCount;
    await updateAnonymousSession(session);

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error updating message count:", error);
    return NextResponse.json(
      { error: "Failed to update message count" },
      { status: 500 },
    );
  }
}

// DELETE /api/session - Delete session
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 },
    );
  }

  try {
    await deleteAnonymousSession(sessionId);
    return NextResponse.json({ message: "Session deleted" });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 },
    );
  }
}
