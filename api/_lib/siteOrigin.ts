/**
 * The public origin the share tags point at (no trailing slash). Precedence:
 * `SITE_URL`, the production domain on production, the deployment URL, then
 * localhost.
 *
 * @param env - Environment to read (defaults to `process.env`)
 * @returns The origin, e.g. `https://agribid-iota.vercel.app`
 */
export function siteOrigin(
  env: Record<string, string | undefined> = process.env
): string {
  const explicit = env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const production = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (env.VERCEL_ENV === "production" && production) {
    return `https://${production}`;
  }
  const deployment = env.VERCEL_URL?.trim();
  if (deployment) return `https://${deployment}`;
  return "http://localhost:5173";
}
