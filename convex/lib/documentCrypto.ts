/**
 * Encryption at rest for uploaded personal documents (ID, passport, proof of
 * address). AES-256-GCM through Web Crypto, so it runs in the default Convex
 * runtime.
 *
 * Stored layout: 12-byte random IV, then the ciphertext, then the 16-byte GCM
 * tag (Web Crypto appends the tag to the ciphertext). A fresh IV is drawn for
 * every file.
 *
 * The key is `DOCUMENT_ENCRYPTION_KEY`: base64 that decodes to exactly 32
 * bytes, separate from `PII_ENCRYPTION_KEY`. The key is read when a file is
 * encrypted or decrypted, not at import, so a missing key fails only document
 * routes (closed) and never takes the rest of the backend down with it.
 */

/** Bytes in the AES-GCM initialisation vector. */
const IV_BYTES = 12;
/** Bytes in an AES-256 key. */
const KEY_BYTES = 32;
/** Bytes in the GCM authentication tag. */
const TAG_BYTES = 16;

/**
 * Development-only key, used only behind `ALLOW_DOCUMENT_DEV_FALLBACK=true`
 * outside production. Never a real secret.
 */
const DEV_FALLBACK_KEY_BASE64 = "ZGV2LWRvY3VtZW50LWtleS0zMi1ieXRlcy1sb25nISE=";

/** Imported key and the base64 it was derived from (so a changed env re-imports). */
let cachedKey: { source: string; key: CryptoKey } | null = null;

/**
 * Decodes base64 to bytes.
 *
 * @param value - Standard base64 text
 * @returns The decoded bytes
 */
function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Resolves the base64 key text from the environment, applying the safety
 * rules: production must have a real key; the dev key needs an explicit flag.
 *
 * @returns The base64 key text
 * @throws When no usable key is configured
 */
function resolveKeySource(): string {
  const configured = process.env.DOCUMENT_ENCRYPTION_KEY;
  const isProduction = process.env.APP_ENV === "production";
  if (configured !== undefined && configured !== "") return configured;
  if (isProduction) {
    throw new Error(
      "CRITICAL: DOCUMENT_ENCRYPTION_KEY environment variable is missing in production."
    );
  }
  if (process.env.ALLOW_DOCUMENT_DEV_FALLBACK === "true") {
    console.warn(
      "SECURITY WARNING: using the hardcoded development document key. Never use this in production."
    );
    return DEV_FALLBACK_KEY_BASE64;
  }
  throw new Error(
    "CRITICAL: DOCUMENT_ENCRYPTION_KEY is required. A development fallback is only allowed with ALLOW_DOCUMENT_DEV_FALLBACK=true outside production."
  );
}

/**
 * Loads the AES-GCM key, validating that it is exactly 32 bytes.
 *
 * @returns The imported key
 * @throws When the key is missing or is not 32 bytes of valid base64
 */
async function getKey(): Promise<CryptoKey> {
  const source = resolveKeySource();
  if (cachedKey?.source === source) return cachedKey.key;

  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = base64ToBytes(source);
  } catch {
    throw new Error("CRITICAL: DOCUMENT_ENCRYPTION_KEY is not valid base64.");
  }
  if (raw.length !== KEY_BYTES) {
    throw new Error(
      `CRITICAL: DOCUMENT_ENCRYPTION_KEY must decode to exactly 32 bytes. Current byte length: ${String(raw.length)}`
    );
  }
  const key = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  cachedKey = { source, key };
  return key;
}

/**
 * Encrypts a file's bytes. The result is `IV || ciphertext || tag`.
 *
 * @param plain - The file bytes
 * @returns The encrypted bytes to store
 * @throws When the document key is missing or invalid
 */
export async function encryptBytes(plain: ArrayBuffer): Promise<ArrayBuffer> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plain
  );
  const out = new Uint8Array(IV_BYTES + sealed.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(sealed), IV_BYTES);
  return out.buffer;
}

/**
 * Decrypts bytes produced by {@link encryptBytes}. Any tampering, truncation
 * or wrong key fails authentication and throws.
 *
 * @param stored - `IV || ciphertext || tag`
 * @returns The original file bytes
 * @throws When the key is invalid, the blob is too short, or the tag fails
 */
export async function decryptBytes(stored: ArrayBuffer): Promise<ArrayBuffer> {
  if (stored.byteLength < IV_BYTES + TAG_BYTES) {
    throw new Error("Encrypted document is too short.");
  }
  const key = await getKey();
  const bytes = new Uint8Array(stored);
  const iv = bytes.slice(0, IV_BYTES);
  const sealed = bytes.subarray(IV_BYTES);
  return await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, sealed);
}
