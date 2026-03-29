// app/convex/config.ts

/**
 * Utility to get an environment variable in the Convex runtime.
 * @param key
 * @returns The value of the environment variable or undefined if not set.
 */
export function getEnv(key: string): string | undefined {
  const env = (
    globalThis as unknown as {
      process: { env: Record<string, string | undefined> };
    }
  ).process.env;
  return env[key];
}

/**
 * Utility to get an environment variable or throw if it's missing.
 * @param key
 * @returns The value of the environment variable.
 */
export function requireEnv(key: string): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Missing ${key} environment variable.`);
  }
  return value;
}

/**
 * The origins allowed to make cross-origin requests to the Convex deployment.
 * Parsed from the ALLOWED_ORIGINS environment variable as a comma-separated list.
 * Defaults to an empty array if not set, meaning no cross-origin requests are allowed.
 * Configure ALLOWED_ORIGINS in the .env.local file (e.g., "http://localhost:5173,.vercel.app")
 * and preview domains (e.g., .vercel.app) to allow all subdomains of vercel.app.
 */
export const ALLOWED_ORIGINS = (getEnv("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Determine whether an origin is permitted by ALLOWED_ORIGINS.
 *
 * Accepts a full origin (e.g. "http://localhost:5173") or a raw hostname. Returns `false` for `null` or `undefined`.
 * Matching rules:
 * - Exact string match against ALLOWED_ORIGINS entries.
 * - An allowed entry beginning with `.` (for example `.vercel.app`) matches hostnames equal to the suffix or ending with `.` + suffix.
 * - If an allowed entry is a URL (starts with "http"), the full origin is compared including protocol (scheme), hostname, and port.
 *   If the incoming origin cannot be parsed as a URL, the entry does not match (returns false).
 *
 * @param origin - The origin or hostname to check; may be a full URL (e.g., "http://localhost:5173"), a hostname (e.g., "localhost"), or `null`/`undefined`
 * @returns `true` if the origin is allowed according to ALLOWED_ORIGINS, `false` otherwise
 */
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;

  let originUrl: URL | null = null;
  let hostname = "";
  try {
    originUrl = new URL(origin);
    hostname = originUrl.hostname;
  } catch {
    // If not a valid URL, it might be a direct hostname string
    hostname = origin;
  }

  return ALLOWED_ORIGINS.some((allowed) => {
    // Exact match for the full origin string
    if (origin === allowed) return true;

    // Wildcard/suffix matching based on hostname (e.g., .vercel.app)
    if (allowed.startsWith(".")) {
      const suffix = allowed.substring(1);
      return hostname === suffix || hostname.endsWith("." + suffix);
    }

    // If 'allowed' is a full URL, compare full origin (scheme + host + port)
    // instead of degrading to hostname-only comparison
    if (allowed.startsWith("http")) {
      try {
        const allowedUrl = new URL(allowed);
        // Compare full origin using URL.origin (scheme + hostname + port)
        // If originUrl is missing/unparseable, full-URL entries require a parseable origin
        if (originUrl) {
          return originUrl.origin === allowedUrl.origin;
        }
        // Origin couldn't be parsed - don't fallback to hostname-only for URL entries
        return false;
      } catch {
        // If allowed URL parsing fails, it cannot match any origin (return false)
        return false;
      }
    }

    // Direct hostname match for plain hostname entries (e.g., "localhost" or "example.com")
    return hostname === allowed;
  });
}

/**
 * Business Logic Constants
 *
 * @deprecated Use the platformFees table to configure fees instead.
 * This constant is kept for backward compatibility with existing code
 * and will be removed in a future version.
 */
export const COMMISSION_RATE = (() => {
  const envVal = getEnv("COMMISSION_RATE");
  if (!envVal) return 0.05;
  const parsed = parseFloat(envVal);
  return isNaN(parsed) ? 0.05 : parsed;
})();
