// app/convex/config.ts

/**
 * Utility to get an environment variable in the Convex runtime.
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
 * - If an allowed entry is a URL, its hostname is used for comparison.
 *
 * @param origin - The origin or hostname to check; may be a full URL, a hostname, or `null`/`undefined`
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
        // Compare full origin: scheme + hostname + port
        if (originUrl) {
          return (
            originUrl.protocol === allowedUrl.protocol &&
            originUrl.hostname === allowedUrl.hostname &&
            originUrl.port === allowedUrl.port
          );
        }
        // If origin couldn't be parsed as URL, compare against allowed URL's host only
        return hostname === allowedUrl.hostname;
      } catch {
        // If parsing fails, fall through to hostname comparison
      }
    }

    // Direct hostname match for plain hostname entries (e.g., "localhost" or "example.com")
    return hostname === allowed;
  });
}

/**
 * Business Logic Constants
 */
export const COMMISSION_RATE = (() => {
  const envVal = getEnv("COMMISSION_RATE");
  if (!envVal) return 0.05;
  const parsed = parseFloat(envVal);
  return isNaN(parsed) ? 0.05 : parsed;
})();
