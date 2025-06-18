/**
 * Simple Encryption for API Keys
 *
 * This module provides client-side encryption/decryption for API keys
 * using the Web Crypto API with AES-GCM encryption.
 */

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: "AES-GCM",
  keyLength: 256, // bits
  ivLength: 12, // bytes (96 bits for GCM)
  saltLength: 32, // bytes (256 bits)
  tagLength: 128, // bits (16 bytes)
  iterations: 100000, // PBKDF2 iterations (OWASP recommended minimum)
} as const;

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  encryptedData: string; // Base64 encoded
  iv: string; // Base64 encoded initialization vector
  salt: string; // Base64 encoded salt
  algorithm: string; // Algorithm identifier
  iterations: number; // PBKDF2 iterations used
}

/**
 * Generate a cryptographically secure random salt
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.saltLength));
}

/**
 * Generate a cryptographically secure random IV
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));
}

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // Derive AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ENCRYPTION_CONFIG.iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: ENCRYPTION_CONFIG.algorithm,
      length: ENCRYPTION_CONFIG.keyLength,
    },
    false, // Not extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt API key using a password/key
 */
export async function encryptApiKey(
  apiKey: string,
  password: string,
): Promise<EncryptedData> {
  try {
    // Generate random salt and IV
    const salt = generateSalt();
    const iv = generateIV();

    // Derive encryption key from password
    const key = await deriveKey(password, salt);

    // Encrypt the API key
    const encodedApiKey = new TextEncoder().encode(apiKey);
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_CONFIG.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength,
      },
      key,
      encodedApiKey,
    );

    // Return encrypted data with metadata
    return {
      encryptedData: btoa(
        String.fromCharCode(...new Uint8Array(encryptedBuffer)),
      ),
      iv: btoa(String.fromCharCode(...iv)),
      salt: btoa(String.fromCharCode(...salt)),
      algorithm: ENCRYPTION_CONFIG.algorithm,
      iterations: ENCRYPTION_CONFIG.iterations,
    };
  } catch (error) {
    console.error("[Encryption] Failed to encrypt API key:", error);
    throw new Error("Failed to encrypt API key");
  }
}

/**
 * Decrypt API key using a password/key
 */
export async function decryptApiKey(
  encryptedData: EncryptedData,
  password: string,
): Promise<string> {
  try {
    // Validate algorithm compatibility
    if (encryptedData.algorithm !== ENCRYPTION_CONFIG.algorithm) {
      throw new Error(
        `Unsupported encryption algorithm: ${encryptedData.algorithm}`,
      );
    }

    // Decode base64 data
    const salt = new Uint8Array(
      atob(encryptedData.salt)
        .split("")
        .map((char) => char.charCodeAt(0)),
    );
    const iv = new Uint8Array(
      atob(encryptedData.iv)
        .split("")
        .map((char) => char.charCodeAt(0)),
    );
    const encrypted = new Uint8Array(
      atob(encryptedData.encryptedData)
        .split("")
        .map((char) => char.charCodeAt(0)),
    );

    // Derive the same encryption key
    const key = await deriveKey(password, salt);

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: encryptedData.algorithm,
        iv: iv,
        tagLength: ENCRYPTION_CONFIG.tagLength,
      },
      key,
      encrypted,
    );

    // Convert back to string
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error("[Encryption] Failed to decrypt API key:", error);
    // Don't expose internal error details for security
    throw new Error(
      "Failed to decrypt API key. Please check your password.",
    );
  }
}

/**
 * Check if Web Crypto API is available
 */
export function isEncryptionSupported(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined" &&
    typeof crypto.getRandomValues !== "undefined"
  );
}
