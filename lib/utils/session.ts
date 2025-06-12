import { v4 as uuidv4 } from "uuid";
import { kv } from "@vercel/kv";

// Session configuration
export const SESSION_CONFIG = {
  // Session expires after 24 hours (in seconds for KV TTL)
  EXPIRY_SECONDS: 24 * 60 * 60, // 86400 seconds = 24 hours
  // Rate limits for anonymous users
  MAX_MESSAGES_PER_SESSION: 10,
  // KV key prefixes
  KV_PREFIX_SESSION: "anon_session:",
  KV_PREFIX_RATE_LIMIT: "anon_rate:",
  KV_PREFIX_LOOKUP: "anon_lookup:",
} as const;

// Anonymous session data structure
export interface AnonymousSessionData {
  sessionId: string;
  messageCount: number;
  remainingMessages: number;
  createdAt: number;
  lastUsedAt: number;
  userAgent: string;
  ipHash: string; // SHA-256 hash of IP for security
  isExpired: boolean;
}

// Rate limiting data structure
export interface RateLimitData {
  count: number;
  windowStart: number;
  lastRequest: number;
}

// Generate a new anonymous session ID
export function generateSessionId(): string {
  return `anon_${uuidv4()}`;
}

// Hash IP address for privacy (one-way hash)
export function hashIP(ip: string): string {
  // Simple hash for demo - in production use crypto.subtle.digest
  return btoa(ip).slice(0, 16);
}

// Hash user-agent (keep small)
export function hashUA(ua: string): string {
  try {
    return btoa(ua).slice(0, 16);
  } catch {
    return "unknown";
  }
}

// Helper to generate the lookup key
function fingerprintKey(ipHash: string, uaHash: string) {
  return `${SESSION_CONFIG.KV_PREFIX_LOOKUP}${ipHash}:${uaHash}`;
}

// Find existing session by fingerprint
export async function findSessionByFingerprint(
  ipHash: string,
  uaHash: string,
): Promise<AnonymousSessionData | null> {
  try {
    const existingSessionId = await kv.get<string>(
      fingerprintKey(ipHash, uaHash),
    );

    if (!existingSessionId) return null;

    const session = await getAnonymousSession(existingSessionId);
    return session;
  } catch {
    return null;
  }
}

// Get user agent safely
export function getUserAgent(): string {
  if (typeof navigator !== "undefined") {
    return navigator.userAgent.slice(0, 200); // Limit length
  }
  return "unknown";
}

// Create new anonymous session in KV
export async function createAnonymousSession(
  userAgent?: string,
  ipHash?: string,
): Promise<AnonymousSessionData> {
  const sessionId = generateSessionId();
  const now = Date.now();

  const sessionData: AnonymousSessionData = {
    sessionId,
    messageCount: 0,
    remainingMessages: SESSION_CONFIG.MAX_MESSAGES_PER_SESSION,
    createdAt: now,
    lastUsedAt: now,
    userAgent: userAgent ?? getUserAgent(),
    ipHash: ipHash ?? "unknown",
    isExpired: false,
  };

  // Store in KV with auto-expiration (24 hours)
  await kv.set(`${SESSION_CONFIG.KV_PREFIX_SESSION}${sessionId}`, sessionData, {
    ex: SESSION_CONFIG.EXPIRY_SECONDS,
  });

  // Also store fingerprint → sessionId mapping so we can resurrect after cookies cleared
  if (ipHash && userAgent) {
    const uaHash = hashUA(userAgent);
    await kv.set(fingerprintKey(ipHash, uaHash), sessionId, {
      ex: SESSION_CONFIG.EXPIRY_SECONDS,
    });
  }

  return sessionData;
}

// Get anonymous session from KV
export async function getAnonymousSession(
  sessionId: string,
): Promise<AnonymousSessionData | null> {
  try {
    const sessionData = await kv.get<AnonymousSessionData>(
      `${SESSION_CONFIG.KV_PREFIX_SESSION}${sessionId}`,
    );

    if (!sessionData) {
      return null;
    }

    // Check if session is expired (double-check beyond KV TTL)
    const isExpired =
      Date.now() - sessionData.createdAt > SESSION_CONFIG.EXPIRY_SECONDS * 1000;

    if (isExpired) {
      // Clean up expired session
      await deleteAnonymousSession(sessionId);
      return null;
    }

    return {
      ...sessionData,
      isExpired: false,
    };
  } catch (error) {
    console.error("Error fetching anonymous session:", error);
    return null;
  }
}

// Update anonymous session in KV
export async function updateAnonymousSession(
  sessionData: AnonymousSessionData,
): Promise<void> {
  try {
    const updatedData = {
      ...sessionData,
      lastUsedAt: Date.now(),
    };

    // Update with fresh TTL
    await kv.set(
      `${SESSION_CONFIG.KV_PREFIX_SESSION}${sessionData.sessionId}`,
      updatedData,
      { ex: SESSION_CONFIG.EXPIRY_SECONDS },
    );
  } catch (error) {
    console.error("Error updating anonymous session:", error);
    throw error;
  }
}

// Increment message count for anonymous session
export async function incrementSessionMessageCount(
  sessionId: string,
): Promise<AnonymousSessionData | null> {
  try {
    const sessionData = await getAnonymousSession(sessionId);
    if (!sessionData) {
      return null;
    }

    if (sessionData.messageCount >= SESSION_CONFIG.MAX_MESSAGES_PER_SESSION) {
      throw new Error("Message limit exceeded for anonymous session");
    }

    const updatedData = {
      ...sessionData,
      messageCount: sessionData.messageCount + 1,
      remainingMessages:
        SESSION_CONFIG.MAX_MESSAGES_PER_SESSION -
        (sessionData.messageCount + 1),
      lastUsedAt: Date.now(),
    };

    await updateAnonymousSession(updatedData);
    return updatedData;
  } catch (error) {
    console.error("Error incrementing message count:", error);
    throw error;
  }
}

// Delete anonymous session from KV
export async function deleteAnonymousSession(sessionId: string): Promise<void> {
  try {
    await kv.del(`${SESSION_CONFIG.KV_PREFIX_SESSION}${sessionId}`);
    await kv.del(`${SESSION_CONFIG.KV_PREFIX_RATE_LIMIT}${sessionId}`);
  } catch (error) {
    console.error("Error deleting anonymous session:", error);
  }
}

// Rate limiting using KV
export async function checkRateLimit(
  sessionId: string,
  limit = 5,
  windowMs = 60000,
): Promise<boolean> {
  try {
    const key = `${SESSION_CONFIG.KV_PREFIX_RATE_LIMIT}${sessionId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get current rate limit data
    const rateLimitData = await kv.get<RateLimitData>(key);

    if (!rateLimitData) {
      // First request - create new rate limit entry
      const newData: RateLimitData = {
        count: 1,
        windowStart: now,
        lastRequest: now,
      };

      await kv.set(key, newData, { ex: Math.ceil(windowMs / 1000) });
      return true; // Allow request
    }

    // Check if we're in a new window
    if (rateLimitData.windowStart < windowStart) {
      // New window - reset count
      const newData: RateLimitData = {
        count: 1,
        windowStart: now,
        lastRequest: now,
      };

      await kv.set(key, newData, { ex: Math.ceil(windowMs / 1000) });
      return true; // Allow request
    }

    // Same window - check if under limit
    if (rateLimitData.count >= limit) {
      return false; // Rate limit exceeded
    }

    // Increment count
    const updatedData: RateLimitData = {
      ...rateLimitData,
      count: rateLimitData.count + 1,
      lastRequest: now,
    };

    await kv.set(key, updatedData, { ex: Math.ceil(windowMs / 1000) });
    return true; // Allow request
  } catch (error) {
    console.error("Error checking rate limit:", error);
    // On error, allow the request (fail open)
    return true;
  }
}

// Get stored session ID from localStorage (fallback for client-side identification)
export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem("anonymous_session_id");
  } catch {
    return null;
  }
}

// Store session ID in localStorage (client-side identification only)
export function storeSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem("anonymous_session_id", sessionId);
  } catch {
    // Ignore localStorage errors
  }
}

// Remove session ID from localStorage
export function removeStoredSessionId(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem("anonymous_session_id");
  } catch {
    // Ignore localStorage errors
  }
}

// Format remaining time for display
export function formatRemainingTime(sessionData: AnonymousSessionData): string {
  const now = Date.now();
  const expiresAt =
    sessionData.createdAt + SESSION_CONFIG.EXPIRY_SECONDS * 1000;
  const remainingMs = expiresAt - now;

  if (remainingMs <= 0) {
    return "Expired";
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Get or create anonymous session (main entry point)
export async function getOrCreateAnonymousSession(
  userAgent?: string,
  ipHash?: string,
): Promise<AnonymousSessionData> {
  // Try to get existing session ID from localStorage
  const storedSessionId = getStoredSessionId();

  if (storedSessionId) {
    // Try to get existing session from KV
    const existingSession = await getAnonymousSession(storedSessionId);
    if (existingSession) {
      return existingSession;
    }
    // Session expired or not found, remove from localStorage
    removeStoredSessionId();
  }

  // Before creating, attempt fingerprint lookup (server only)
  if (ipHash && userAgent) {
    const uaHash = hashUA(userAgent);
    const fingerprintSession = await findSessionByFingerprint(ipHash, uaHash);
    if (fingerprintSession) {
      // Store in localStorage for future and return
      storeSessionId(fingerprintSession.sessionId);
      return fingerprintSession;
    }
  }

  // Create new session
  const newSession = await createAnonymousSession(userAgent, ipHash);

  // Store session ID in localStorage for client-side identification
  storeSessionId(newSession.sessionId);

  return newSession;
}
