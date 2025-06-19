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
  if (!fingerprintHash) return null;
  try {
    const existingSessionId = await kv.get<string>(
      fingerprintKey(fingerprintHash),
    );

    if (!existingSessionId) return null;

    const session = await getAnonymousSession(existingSessionId);
    if (session && !session.isExpired) {
      return session;
    }
    return null;
  } catch (error) {
    console.error("Error finding session by fingerprint:", error);
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

// Create a new anonymous session, ensuring no race conditions
export async function createAnonymousSession(
  userAgent: string = "unknown",
  ipHash: string = "unknown",
  fingerprintHash?: string,
): Promise<AnonymousSessionData> {
  const sessionId = generateSessionId();
  const now = Date.now();

  const newSession: AnonymousSessionData = {
    sessionId,
    messageCount: 0,
    remainingMessages: SESSION_CONFIG.MAX_MESSAGES_PER_SESSION,
    createdAt: now,
    lastUsedAt: now,
    userAgent,
    ipHash,
    isExpired: false,
    fingerprintHash: fingerprintHash || "unknown",
    trustScore: 10, // Start with a baseline trust
    trustLevel: "NEW",
    behaviorScore: 0,
    lastFingerprintUpdate: now,
  };

  try {
    // Use a transaction to ensure atomicity if fingerprint is present
    if (fingerprintHash) {
      const key = fingerprintKey(fingerprintHash);
      // SETNX: Set if not exists. If it returns 0, a session already exists.
      const wasSet = await kv.set(key, sessionId, {
        nx: true,
        ex: SESSION_CONFIG.EXPIRY_SECONDS,
      });

      if (!wasSet) {
        // A session for this fingerprint was created in another request.
        // Fetch and return that session instead of creating a new one.
        const existingSessionId = await kv.get<string>(key);
        if (existingSessionId) {
          const existingSession = await getAnonymousSession(existingSessionId);
          if (existingSession) return existingSession;
        }
      }
    }

    // If we reach here, either no fingerprint or we won the race.
    // Store the main session data.
    await kv.set(
      `${SESSION_CONFIG.KV_PREFIX_SESSION}${sessionId}`,
      JSON.stringify(newSession),
      { ex: SESSION_CONFIG.EXPIRY_SECONDS },
    );
    return newSession;
  } catch (error) {
    console.error("Error creating anonymous session:", error);
    // In case of error, return a transient session object to avoid breaking the app
    return { ...newSession, sessionId: `error_${uuidv4()}` };
  }
}

// Get anonymous session data from KV store
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

// Update existing anonymous session data in KV store
export async function updateAnonymousSession(
  sessionData: AnonymousSessionData,
): Promise<void> {
  try {
    const key = `${SESSION_CONFIG.KV_PREFIX_SESSION}${sessionData.sessionId}`;
    // Check if the session still exists before updating
    const sessionExists = await kv.exists(key);
    if (!sessionExists) {
      console.warn(
        `Attempted to update a non-existent or expired session: ${sessionData.sessionId}`,
      );
      return;
    }
    await kv.set(key, JSON.stringify(sessionData), {
      ex: SESSION_CONFIG.EXPIRY_SECONDS,
    });
  } catch (error) {
    console.error("Error updating anonymous session:", error);
  }
}

// Update user behavior patterns for bot detection
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

// Increment message count and update session activity
export async function incrementSessionMessageCount(
  sessionId: string,
): Promise<AnonymousSessionData | null> {
  try {
    const session = await getAnonymousSession(sessionId);

    if (!session) return null;

    if (session.remainingMessages <= 0) {
      console.warn(`Session ${sessionId} has no remaining messages.`);
      return session; // No change if limit is reached
    }

    const updatedSession = {
      ...session,
      messageCount: session.messageCount + 1,
      remainingMessages: session.remainingMessages - 1,
      lastUsedAt: Date.now(),
    };

    await updateAnonymousSession(updatedSession);

    // After updating, trigger behavior and trust analysis
    await updateBehaviorPattern(sessionId, Date.now());
    await updateTrustScore(sessionId);

    return updatedSession;
  } catch (error) {
    console.error("Error incrementing message count:", error);
    return null;
  }
}

// Delete an anonymous session from all related KV keys
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

// Check rate limit for an anonymous user
export async function checkRateLimit(sessionId: string): Promise<{
  allowed: boolean;
  reason?: string;
  trustLevel: keyof typeof SESSION_CONFIG.TRUST_LEVELS;
}> {
  try {
    const session = await getAnonymousSession(sessionId);
    const trustLevel = session?.trustLevel ?? "NEW";
    const limits = SESSION_CONFIG.TRUST_LEVELS[trustLevel];

    const key = `${SESSION_CONFIG.KV_PREFIX_RATE_LIMIT}${sessionId}`;
    const pipeline = kv.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, limits.windowMs / 1000);
    const [count] = (await pipeline.exec()) as [number, number];

    if (count > limits.maxMessages) {
      return {
        allowed: false,
        reason: `Rate limit exceeded. Level: ${trustLevel}`,
        trustLevel,
      };
    }

    return { allowed: true, trustLevel };
  } catch (error) {
    console.error("Error checking rate limit:", error);
    return {
      allowed: false,
      reason: "Rate limit check failed",
      trustLevel: "NEW",
    };
  }
}

// Helper to get session ID from browser storage
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
    console.error("Local storage is not available.");
  }
}

export function removeStoredSessionId(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem("anonymous_session_id");
  } catch {
    console.error("Local storage is not available.");
  }
}

// Format remaining time for session expiry
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

// Get or create an anonymous session
export async function getOrCreateAnonymousSession(
  userAgent?: string,
  ipHash?: string,
  fingerprintHash?: string,
): Promise<AnonymousSessionData> {
  // 1. Try to find session by fingerprint first
  if (fingerprintHash) {
    const existingSession = await findSessionByFingerprint(fingerprintHash);
    if (existingSession) {
      return existingSession;
    }
  }

  // 2. If not found, create a new session
  return createAnonymousSession(userAgent, ipHash, fingerprintHash);
}
