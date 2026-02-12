// app/convex/config.ts

/**
 * The origins allowed to make cross-origin requests to the Convex deployment.
 * Parsed from the ALLOWED_ORIGINS environment variable as a comma-separated list.
 * Defaults to http://localhost:5173 for local development.
 */
export const ALLOWED_ORIGINS = (
  (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env.ALLOWED_ORIGINS ?? 
  "http://localhost:5173"
).split(",").map(origin => origin.trim());
