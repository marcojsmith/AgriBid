import type { MutationCtx } from "./_generated/server";

/**
 * Centralized audit logging helper.
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
  if (!identity) return;

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

// Helper to get CryptoKey
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

function base64ToArrayBuffer(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

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
