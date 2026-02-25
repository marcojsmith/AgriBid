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
 * Includes common local development ports and .vercel.app for previews by default.
 */
export const ALLOWED_ORIGINS = (getEnv("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Checks if a given origin (e.g., "http://localhost:5173") is allowed
 * based on the ALLOWED_ORIGINS configuration.
 */
export function isOriginAllowed(origin: string | null | undefined): boolean {
  if (!origin) return false;

  let hostname = "";
  try {
    hostname = new URL(origin).hostname;
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

    // Direct hostname match: if 'allowed' is a URL, extract its hostname first
    let allowedHostname = allowed;
    try {
      if (allowed.startsWith("http")) {
        allowedHostname = new URL(allowed).hostname;
      }
    } catch {
      // Stay with original 'allowed' value
    }
    return hostname === allowedHostname;
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
