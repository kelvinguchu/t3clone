import { v4 as uuidv4 } from "uuid";
import { kv } from "@vercel/kv";
import crypto from "crypto";

// Configuration for anonymous session management and rate limiting
export const SESSION_CONFIG = {
  EXPIRY_SECONDS: 24 * 60 * 60, // Session expires after 24 hours
  MAX_MESSAGES_PER_SESSION: 10,
  // Progressive trust levels based on user behavior
  TRUST_LEVELS: {
    NEW: { maxMessages: 5, windowMs: 60000 }, // New users: 5 msgs/min
    ESTABLISHED: { maxMessages: 10, windowMs: 60000 }, // Established: 10 msgs/min
    TRUSTED: { maxMessages: 20, windowMs: 60000 }, // Trusted: 20 msgs/min
  },
  BEHAVIOR_WINDOW_MS: 10 * 60 * 1000, // 10 minutes for behavioral analysis
  // KV storage key prefixes
  KV_PREFIX_SESSION: "anon_session:",
  KV_PREFIX_RATE_LIMIT: "anon_rate:",
  KV_PREFIX_LOOKUP: "anon_lookup:",
  KV_PREFIX_FINGERPRINT: "anon_fp:",
  KV_PREFIX_BEHAVIOR: "anon_behavior:",
  KV_PREFIX_TRUST: "anon_trust:",
} as const;

// Browser fingerprint data for device identification
export interface BrowserFingerprint {
  userAgent: string;
  language: string;
  languages: string[];
  timezone: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: string;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  webgl: string; // WebGL renderer signature
  canvas: string; // Canvas fingerprint
  audio: string; // Audio context fingerprint
}

// User behavior patterns for bot detection
export interface BehaviorPattern {
  sessionId: string;
  requestTimestamps: number[];
  averageInterval: number;
  burstCount: number;
  lastBurstTime: number;
  typingPatterns: number[]; // Time between keystrokes
  mouseMovements: number; // Mouse movement entropy
  suspiciousActivities: string[];
}

// Trust scoring system
export interface TrustScore {
  sessionId: string;
  score: number; // 0-100
  factors: {
    consistency: number; // Fingerprint consistency over time
    behavior: number; // Natural vs automated behavior
    timeSpent: number; // Time spent on site
    interactions: number; // Quality of interactions
  };
  level: keyof typeof SESSION_CONFIG.TRUST_LEVELS;
  lastUpdated: number;
}

// Anonymous session data structure
export interface AnonymousSessionData {
  sessionId: string;
  messageCount: number;
  remainingMessages: number;
  createdAt: number;
  lastUsedAt: number;
  userAgent: string;
  ipHash: string; 
  isExpired: boolean;
  fingerprintHash: string;
  trustScore: number;
  trustLevel: keyof typeof SESSION_CONFIG.TRUST_LEVELS;
  behaviorScore: number;
  lastFingerprintUpdate: number;
}

// Rate limiting data structure
export interface RateLimitData {
  count: number;
  windowStart: number;
  lastRequest: number;
  trustLevel: keyof typeof SESSION_CONFIG.TRUST_LEVELS;
  behaviorScore: number;
}

// Generate a new anonymous session ID
export function generateSessionId(): string {
  return `anon_${uuidv4()}`;
}

// Hash IP address with salt for privacy
export function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "default-salt";
  return crypto
    .createHash("sha256")
    .update(ip + salt)
    .digest("hex")
    .slice(0, 16);
}

// Hash user-agent string
export function hashUA(ua: string): string {
  try {
    return crypto.createHash("sha256").update(ua).digest("hex").slice(0, 16);
  } catch {
    return "unknown";
  }
}

// Generate comprehensive browser fingerprint hash
export function generateFingerprintHash(
  fingerprint: BrowserFingerprint,
): string {
  const fingerprintString = JSON.stringify({
    userAgent: fingerprint.userAgent,
    language: fingerprint.language,
    languages: fingerprint.languages.sort(),
    timezone: fingerprint.timezone,
    screen: fingerprint.screen,
    platform: fingerprint.platform,
    cookieEnabled: fingerprint.cookieEnabled,
    doNotTrack: fingerprint.doNotTrack,
    hardwareConcurrency: fingerprint.hardwareConcurrency,
    maxTouchPoints: fingerprint.maxTouchPoints,
    webgl: fingerprint.webgl,
    canvas: fingerprint.canvas,
    audio: fingerprint.audio,
  });

  return crypto.createHash("sha256").update(fingerprintString).digest("hex");
}

// Calculate trust score based on behavioral factors
export function calculateTrustScore(
  behaviorPattern: BehaviorPattern,
  fingerprintConsistency: number,
  timeSpent: number,
  interactionQuality: number,
): TrustScore {
  const factors = {
    consistency: Math.min(100, fingerprintConsistency * 100),
    behavior: Math.min(
      100,
      Math.max(0, 100 - behaviorPattern.suspiciousActivities.length * 20),
    ),
    timeSpent: Math.min(100, (timeSpent / (60 * 1000)) * 10), // 10 points per minute, max 100
    interactions: Math.min(100, interactionQuality),
  };

  const score =
    factors.consistency * 0.3 +
    factors.behavior * 0.4 +
    factors.timeSpent * 0.2 +
    factors.interactions * 0.1;

  let level: keyof typeof SESSION_CONFIG.TRUST_LEVELS;
  if (score >= 70) {
    level = "TRUSTED";
  } else if (score >= 40) {
    level = "ESTABLISHED";
  } else {
    level = "NEW";
  }

  return {
    sessionId: behaviorPattern.sessionId,
    score,
    factors,
    level,
    lastUpdated: Date.now(),
  };
}

// Analyze behavioral patterns for bot detection
export function analyzeBehaviorPattern(pattern: BehaviorPattern): string[] {
  const suspicious: string[] = [];

  // Check for rapid-fire requests (bot-like behavior)
  if (pattern.averageInterval < 100) {
    suspicious.push("rapid_requests");
  }

  // Check for too regular intervals (automated behavior)
  if (pattern.requestTimestamps.length > 5) {
    const intervals = pattern.requestTimestamps
      .slice(1)
      .map((time, i) => time - pattern.requestTimestamps[i]);
    const variance =
      intervals.reduce((sum, interval) => {
        const diff = interval - pattern.averageInterval;
        return sum + diff * diff;
      }, 0) / intervals.length;

    if (variance < 10) {
      suspicious.push("regular_intervals");
    }
  }

  // Check for burst patterns
  if (pattern.burstCount > 10) {
    suspicious.push("burst_pattern");
  }

  // Check for lack of natural mouse movements
  if (pattern.mouseMovements < 0.1) {
    suspicious.push("no_mouse_movement");
  }

  return suspicious;
}

// Helper to generate the lookup key
function fingerprintKey(fingerprintHash: string) {
  return `${SESSION_CONFIG.KV_PREFIX_FINGERPRINT}${fingerprintHash}`;
}

// Find existing session by comprehensive fingerprint
export async function findSessionByFingerprint(
  fingerprintHash: string,
): Promise<AnonymousSessionData | null> {
  try {
    const existingSessionId = await kv.get<string>(
      fingerprintKey(fingerprintHash),
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

// Create new anonymous session in KV store
export async function createAnonymousSession(
  userAgent?: string,
  ipHash?: string,
  fingerprintHash?: string,
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
    fingerprintHash: fingerprintHash ?? "unknown",
    trustScore: 25, // Start with low trust
    trustLevel: "NEW",
    behaviorScore: 50, // Neutral behavior score
    lastFingerprintUpdate: now,
  };

  // Store in KV with auto-expiration
  await kv.set(`${SESSION_CONFIG.KV_PREFIX_SESSION}${sessionId}`, sessionData, {
    ex: SESSION_CONFIG.EXPIRY_SECONDS,
  });

  // Store fingerprint → sessionId mapping
  if (fingerprintHash && fingerprintHash !== "unknown") {
    await kv.set(fingerprintKey(fingerprintHash), sessionId, {
      ex: SESSION_CONFIG.EXPIRY_SECONDS,
    });
  }

  return sessionData;
}

// Get anonymous session from KV store
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

// Update anonymous session in KV store
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

// Update behavior pattern for bot detection
export async function updateBehaviorPattern(
  sessionId: string,
  requestTime: number,
  mouseMovement?: number,
  typingInterval?: number,
): Promise<void> {
  try {
    const key = `${SESSION_CONFIG.KV_PREFIX_BEHAVIOR}${sessionId}`;
    const existing = await kv.get<BehaviorPattern>(key);

    const now = Date.now();
    const windowStart = now - SESSION_CONFIG.BEHAVIOR_WINDOW_MS;

    // Filter timestamps to current window
    const recentTimestamps =
      existing?.requestTimestamps.filter((t) => t > windowStart) || [];
    recentTimestamps.push(requestTime);

    // Calculate metrics
    const intervals = recentTimestamps
      .slice(1)
      .map((time, i) => time - recentTimestamps[i]);
    const averageInterval =
      intervals.length > 0
        ? intervals.reduce((sum, interval) => sum + interval, 0) /
          intervals.length
        : 0;

    // Detect bursts (more than 5 requests in 10 seconds)
    const recentRequests = recentTimestamps.filter((t) => t > now - 10000);
    const burstCount =
      recentRequests.length > 5
        ? (existing?.burstCount || 0) + 1
        : existing?.burstCount || 0;

    const pattern: BehaviorPattern = {
      sessionId,
      requestTimestamps: recentTimestamps.slice(-50), // Keep last 50 requests
      averageInterval,
      burstCount,
      lastBurstTime:
        recentRequests.length > 5 ? now : existing?.lastBurstTime || 0,
      typingPatterns: typingInterval
        ? [...(existing?.typingPatterns || []), typingInterval].slice(-20)
        : existing?.typingPatterns || [],
      mouseMovements: mouseMovement || existing?.mouseMovements || 0,
      suspiciousActivities: analyzeBehaviorPattern({
        sessionId,
        requestTimestamps: recentTimestamps,
        averageInterval,
        burstCount,
        lastBurstTime:
          recentRequests.length > 5 ? now : existing?.lastBurstTime || 0,
        typingPatterns: existing?.typingPatterns || [],
        mouseMovements: mouseMovement || existing?.mouseMovements || 0,
        suspiciousActivities: [],
      }),
    };

    await kv.set(key, pattern, { ex: SESSION_CONFIG.EXPIRY_SECONDS });
  } catch (error) {
    console.error("Error updating behavior pattern:", error);
  }
}

// Update trust score for a session
export async function updateTrustScore(
  sessionId: string,
  fingerprintConsistency: number = 1.0,
  interactionQuality: number = 50,
): Promise<void> {
  try {
    const behaviorKey = `${SESSION_CONFIG.KV_PREFIX_BEHAVIOR}${sessionId}`;
    const trustKey = `${SESSION_CONFIG.KV_PREFIX_TRUST}${sessionId}`;

    const behaviorPattern = await kv.get<BehaviorPattern>(behaviorKey);
    const session = await getAnonymousSession(sessionId);

    if (!behaviorPattern || !session) return;

    const timeSpent = Date.now() - session.createdAt;
    const trustScore = calculateTrustScore(
      behaviorPattern,
      fingerprintConsistency,
      timeSpent,
      interactionQuality,
    );

    await kv.set(trustKey, trustScore, { ex: SESSION_CONFIG.EXPIRY_SECONDS });

    // Update session with new trust level
    await updateAnonymousSession({
      ...session,
      trustScore: trustScore.score,
      trustLevel: trustScore.level,
      behaviorScore: trustScore.factors.behavior,
    });
  } catch (error) {
    console.error("Error updating trust score:", error);
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
    await updateBehaviorPattern(sessionId, Date.now());
    await updateTrustScore(sessionId);

    return updatedData;
  } catch (error) {
    console.error("Error incrementing message count:", error);
    throw error;
  }
}

// Delete anonymous session from KV store
export async function deleteAnonymousSession(sessionId: string): Promise<void> {
  try {
    await kv.del(`${SESSION_CONFIG.KV_PREFIX_SESSION}${sessionId}`);
    await kv.del(`${SESSION_CONFIG.KV_PREFIX_RATE_LIMIT}${sessionId}`);
    await kv.del(`${SESSION_CONFIG.KV_PREFIX_BEHAVIOR}${sessionId}`);
    await kv.del(`${SESSION_CONFIG.KV_PREFIX_TRUST}${sessionId}`);
  } catch (error) {
    console.error("Error deleting anonymous session:", error);
  }
}

// Multi-factor rate limiting without relying solely on IP
export async function checkRateLimit(
  sessionId: string,
): Promise<{ allowed: boolean; reason?: string; trustLevel: string }> {
  try {
    const session = await getAnonymousSession(sessionId);
    if (!session) {
      return { allowed: false, reason: "Session not found", trustLevel: "NEW" };
    }

    const trustKey = `${SESSION_CONFIG.KV_PREFIX_TRUST}${sessionId}`;
    const trustData = await kv.get<TrustScore>(trustKey);
    const trustLevel = trustData?.level || session.trustLevel;
    const limits = SESSION_CONFIG.TRUST_LEVELS[trustLevel];

    const key = `${SESSION_CONFIG.KV_PREFIX_RATE_LIMIT}${sessionId}`;
    const now = Date.now();
    const windowStart = now - limits.windowMs;

    // Get current rate limit data
    const rateLimitData = await kv.get<RateLimitData>(key);

    if (!rateLimitData) {
      // First request - create new rate limit entry
      const newData: RateLimitData = {
        count: 1,
        windowStart: now,
        lastRequest: now,
        trustLevel,
        behaviorScore: session.behaviorScore,
      };

      await kv.set(key, newData, { ex: Math.ceil(limits.windowMs / 1000) });
      return { allowed: true, trustLevel };
    }

    // Check if we're in a new window
    if (rateLimitData.windowStart < windowStart) {
      // New window - reset count
      const newData: RateLimitData = {
        count: 1,
        windowStart: now,
        lastRequest: now,
        trustLevel,
        behaviorScore: session.behaviorScore,
      };

      await kv.set(key, newData, { ex: Math.ceil(limits.windowMs / 1000) });
      return { allowed: true, trustLevel };
    }

    // Same window - check if under limit
    if (rateLimitData.count >= limits.maxMessages) {
      return {
        allowed: false,
        reason: `Rate limit exceeded for trust level ${trustLevel}`,
        trustLevel,
      };
    }

    // Check for suspicious behavior
    const behaviorKey = `${SESSION_CONFIG.KV_PREFIX_BEHAVIOR}${sessionId}`;
    const behaviorPattern = await kv.get<BehaviorPattern>(behaviorKey);

    if (behaviorPattern && behaviorPattern.suspiciousActivities.length > 3) {
      return {
        allowed: false,
        reason: "Suspicious behavior detected",
        trustLevel,
      };
    }

    // Increment count
    const updatedData: RateLimitData = {
      ...rateLimitData,
      count: rateLimitData.count + 1,
      lastRequest: now,
      trustLevel,
      behaviorScore: session.behaviorScore,
    };

    await kv.set(key, updatedData, { ex: Math.ceil(limits.windowMs / 1000) });
    return { allowed: true, trustLevel };
  } catch (error) {
    console.error("Error checking rate limit:", error);
    // On error, allow the request (fail open) but with NEW trust level
    return { allowed: true, trustLevel: "NEW" };
  }
}

// Client-side localStorage helpers for session identification
export function getStoredSessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem("anonymous_session_id");
  } catch {
    return null;
  }
}

export function storeSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem("anonymous_session_id", sessionId);
  } catch {
    // Ignore localStorage errors
  }
}

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

// Main entry point for session management
export async function getOrCreateAnonymousSession(
  userAgent?: string,
  ipHash?: string,
  fingerprintHash?: string,
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
  if (fingerprintHash && fingerprintHash !== "unknown") {
    const fingerprintSession = await findSessionByFingerprint(fingerprintHash);
    if (fingerprintSession) {
      // Store in localStorage for future and return
      storeSessionId(fingerprintSession.sessionId);
      return fingerprintSession;
    }
  }

  // Create new session
  const newSession = await createAnonymousSession(
    userAgent,
    ipHash,
    fingerprintHash,
  );

  // Store session ID in localStorage for client-side identification
  storeSessionId(newSession.sessionId);

  return newSession;
}
