/**
 * Client side of the protected document routes (`/documents/upload` and
 * `/documents/file`). They live on the Convex HTTP origin ("site URL"), not
 * the websocket/API origin, and need the Clerk token for Convex as a bearer.
 */

/** Which stored document a request reads. */
export type DocumentTarget =
  | { kind: "registration"; id: string }
  | { kind: "legacy"; userId: string; index: number };

/** Types the browser may render inline; anything else is not previewed. */
const PREVIEWABLE_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

/**
 * The origin that serves Convex HTTP actions.
 *
 * Uses `VITE_CONVEX_SITE_URL` when set (required on the self-hosted backend,
 * where it is the `:8443` origin). Otherwise derives it from a Convex Cloud
 * URL (`*.convex.cloud` becomes `*.convex.site`).
 *
 * @returns The origin without a trailing slash
 * @throws When neither a site URL nor a Convex Cloud URL is configured
 */
export function getConvexSiteUrl(): string {
  const explicit = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  if (explicit) return explicit.replace(/\/+$/, "");
  const cloud = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (cloud?.endsWith(".convex.cloud")) {
    return cloud.replace(/\.convex\.cloud$/, ".convex.site");
  }
  throw new Error("VITE_CONVEX_SITE_URL is not set.");
}

/**
 * Builds the URL that reads one document.
 *
 * @param target - The document to read
 * @returns The absolute URL on the Convex HTTP origin
 */
export function documentFileUrl(target: DocumentTarget): string {
  const params =
    target.kind === "registration"
      ? new URLSearchParams({ id: target.id })
      : new URLSearchParams({
          legacyUser: target.userId,
          index: String(target.index),
        });
  return `${getConvexSiteUrl()}/documents/file?${params.toString()}`;
}

/**
 * Fetches a protected document as a blob, sending the bearer token. The blob
 * carries the response's type only when it is an image or PDF; any other type
 * becomes an untyped blob so it can never render as script or markup.
 *
 * @param target - The document to read
 * @param token - The Clerk token for Convex
 * @param signal - Aborts the request
 * @returns The file
 * @throws When the server refuses or cannot find the document
 */
export async function fetchProtectedDocument(
  target: DocumentTarget,
  token: string,
  signal?: AbortSignal
): Promise<Blob> {
  const response = await fetch(documentFileUrl(target), {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "That document isn't available."
        : "Couldn't load that document."
    );
  }
  const type = response.headers.get("Content-Type") ?? "";
  const bytes = await response.blob();
  return new Blob([bytes], {
    type: PREVIEWABLE_TYPES.has(type) ? type : "application/octet-stream",
  });
}
