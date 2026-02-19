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
 * Defaults to http://localhost:5173 for local development.
 */
export const ALLOWED_ORIGINS = (
  getEnv("ALLOWED_ORIGINS") ?? "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Business Logic Constants
 */
export const COMMISSION_RATE = (() => {
  const envVal = getEnv("COMMISSION_RATE");
  if (!envVal) return 0.05;
  const parsed = parseFloat(envVal);
  return isNaN(parsed) ? 0.05 : parsed;
})();
