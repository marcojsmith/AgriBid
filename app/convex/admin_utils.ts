import type { MutationCtx } from "./_generated/server";

/**
 * Record an audit log entry for the current authenticated admin.
 *
 * If there is no authenticated user identity, the function returns without creating a log.
 *
 * @param args.action - Short identifier of the action performed (e.g., "delete_user", "update_settings")
 * @param args.targetId - Optional identifier of the target resource affected by the action
 * @param args.targetType - Optional type/category of the target resource (e.g., "user", "project")
 * @param args.details - Optional free-form details about the action or context
 * @param args.targetCount - Optional number of targets affected by the action
 */
export async function logAudit(
  ctx: MutationCtx, 
  args: { 
    action: string; 
    targetId?: string; 
    targetType?: string; 
    details?: string;
    targetCount?: number;
  }
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    console.warn(`logAudit called without identity for action: ${args.action}`);
    return;
  }

  await ctx.db.insert("auditLogs", {
    adminId: identity.subject,
    action: args.action,
    targetId: args.targetId,
    targetType: args.targetType,
    details: args.details,
    targetCount: args.targetCount,
    timestamp: Date.now(),
  });
}

/**
 * Robust encryption/decryption for PII using AES-256-GCM (Web Crypto API).
 * Compatible with Convex standard runtime.
 */
const ENCRYPTION_KEY_STR = process.env.PII_ENCRYPTION_KEY;
const IS_PRODUCTION = !!process.env.CONVEX_CLOUD_URL;

// Validation: Key must exist in production and must be 32 bytes
if (IS_PRODUCTION && !ENCRYPTION_KEY_STR) {
  throw new Error("CRITICAL: PII_ENCRYPTION_KEY environment variable is missing in production.");
}

if (ENCRYPTION_KEY_STR) {
  const keyBytes = new TextEncoder().encode(ENCRYPTION_KEY_STR);
  if (keyBytes.length !== 32) {
    throw new Error(`CRITICAL: PII_ENCRYPTION_KEY must be exactly 32 bytes. Current byte length: ${keyBytes.length}`);
  }
}

// Only allow fallback to temporary dev key when not in production
const FINAL_KEY_STR = (IS_PRODUCTION || ENCRYPTION_KEY_STR)
  ? (ENCRYPTION_KEY_STR || "")
  : "temporary-dev-key-32-chars-long!";

/**
 * Derives a CryptoKey for AES-GCM encryption/decryption from the module's final key string.
 *
 * @returns A CryptoKey configured for AES-GCM usable for both encryption and decryption
 */
async function getCryptoKey() {
  const enc = new TextEncoder();
  const keyData = enc.encode(FINAL_KEY_STR);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encode an ArrayBuffer or Uint8Array as a base64 string.
 *
 * @param buffer - The input bytes to encode, provided as an ArrayBuffer or Uint8Array
 * @returns The base64-encoded representation of `buffer`
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  const CHUNK_SIZE = 65536; // 64KB chunks
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

/**
 * Decode a base64-encoded string into a byte buffer.
 *
 * @param base64 - A base64-encoded string representing binary data
 * @returns A `Uint8Array` containing the decoded bytes
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * Encrypts a plaintext string (PII) using AES-GCM and returns a compact encoded form.
 *
 * @param value - The plaintext to encrypt. If `undefined` or `null`, the function returns `undefined`.
 * @returns The encrypted result formatted as `ivBase64.encryptedBase64`, or `undefined` when input is `undefined`/`null`.
 * @throws Error when encryption fails (message prefixed with `encryptPII failed:`).
 */
export async function encryptPII(value: string | undefined): Promise<string | undefined> {
  if (value === undefined || value === null) return undefined;
  
  try {
    const enc = new TextEncoder();
    const data = enc.encode(value);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getCryptoKey();
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as any },
      key,
      data as any
    );
    
    // Use exact bytes of the Uint8Array/ArrayBuffer for conversion
    const ivBase64 = arrayBufferToBase64(iv);
    const encryptedBase64 = arrayBufferToBase64(new Uint8Array(encryptedBuffer));
    
    // Format: iv.encryptedContentWithTag
    return `${ivBase64}.${encryptedBase64}`;
  } catch (err) {
    console.error("Encryption error:", err);
    throw new Error(`encryptPII failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Decrypts a PII string produced by the matching encryptPII function.
 *
 * If `encrypted` is `undefined` or `null`, returns `undefined`. If `encrypted` does not match the expected
 * encrypted format (`iv.encryptedBase64`), the original input is returned unchanged (legacy/plaintext passthrough).
 *
 * @param encrypted - The value to decrypt, expected in the `iv.encryptedBase64` format produced by encryption; may be plaintext or `undefined`.
 * @returns The decrypted plaintext string, the original input when it is not in the expected encrypted format, or `undefined` when input is `undefined`/`null`.
 * @throws Error when decryption is attempted but fails (e.g., authentication/tag mismatch or key errors).
 */
export async function decryptPII(encrypted: string | undefined): Promise<string | undefined> {
  if (encrypted === undefined || encrypted === null) return undefined;
  
  // Check if it looks like our encrypted format (iv.encryptedContentWithTag)
  const parts = encrypted.split(".");
  if (parts.length !== 2) {
    // Return original for legacy/plaintext
    return encrypted;
  }

  try {
    const [ivBase64, encryptedBase64] = parts;
    const iv = base64ToArrayBuffer(ivBase64);
    const data = base64ToArrayBuffer(encryptedBase64);
    const key = await getCryptoKey();
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as any },
      key,
      data as any
    );
    
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.error("Decryption error:", err);
    throw new Error(`Decryption failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}