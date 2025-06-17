/**
 * Clone protection utilities to ensure single-copy guarantees
 */

// Track ongoing clone operations to prevent duplicates
const ongoingClones = new Map<string, Promise<string>>();

/**
 * Get a unique key for a clone operation
 */
export function getCloneKey(userId: string, shareToken: string): string {
  return `${userId}:${shareToken}`;
}

/**
 * Check if a clone operation is already in progress
 */
export function isCloneInProgress(userId: string, shareToken: string): boolean {
  const key = getCloneKey(userId, shareToken);
  return ongoingClones.has(key);
}

/**
 * Register a clone operation to prevent duplicates
 */
export function registerCloneOperation(
  userId: string,
  shareToken: string,
  promise: Promise<string>,
): Promise<string> {
  const key = getCloneKey(userId, shareToken);

  // Clean up when the operation completes (success or failure)
  const cleanupPromise = promise.finally(() => {
    ongoingClones.delete(key);
  });

  ongoingClones.set(key, cleanupPromise);
  return cleanupPromise;
}

/**
 * Get an existing clone operation if one is in progress
 */
export function getOngoingCloneOperation(
  userId: string,
  shareToken: string,
): Promise<string> | null {
  const key = getCloneKey(userId, shareToken);
  return ongoingClones.get(key) || null;
}

/**
 * Validate clone request parameters
 */
export function validateCloneRequest(params: {
  token?: string;
  action?: string;
  userId?: string;
}): { isValid: boolean; error?: string } {
  if (!params.token) {
    return { isValid: false, error: "Share token is required" };
  }

  if (!params.action || params.action !== "clone") {
    return { isValid: false, error: "Invalid action" };
  }

  if (!params.userId) {
    return { isValid: false, error: "User authentication required" };
  }

  // Validate token format (should be a UUID)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.token)) {
    return { isValid: false, error: "Invalid share token format" };
  }

  return { isValid: true };
}

/**
 * Clear all ongoing clone operations (useful for cleanup)
 */
export function clearAllCloneOperations(): void {
  ongoingClones.clear();
}

/**
 * Get cache key for local storage
 */
export function getCloneCacheKey(userId: string, shareToken: string): string {
  return `t3chat_clone_${userId}_${shareToken}`;
}

/**
 * Check cached clone result
 */
export function getCachedCloneResult(
  userId: string,
  shareToken: string,
): string | null {
  if (typeof window === "undefined") return null;

  try {
    const cacheKey = getCloneCacheKey(userId, shareToken);
    return localStorage.getItem(cacheKey);
  } catch {
    return null;
  }
}

/**
 * Cache clone result
 */
export function setCachedCloneResult(
  userId: string,
  shareToken: string,
  threadId: string,
): void {
  if (typeof window === "undefined") return;

  try {
    const cacheKey = getCloneCacheKey(userId, shareToken);
    localStorage.setItem(cacheKey, threadId);

    // Set expiration (24 hours)
    const expirationKey = `${cacheKey}_expires`;
    const expirationTime = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem(expirationKey, expirationTime.toString());
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if cached result is still valid
 */
export function isCachedResultValid(
  userId: string,
  shareToken: string,
): boolean {
  if (typeof window === "undefined") return false;

  try {
    const cacheKey = getCloneCacheKey(userId, shareToken);
    const expirationKey = `${cacheKey}_expires`;
    const expirationTime = localStorage.getItem(expirationKey);

    if (!expirationTime) return false;

    return Date.now() < parseInt(expirationTime, 10);
  } catch {
    return false;
  }
}
