import { isPreviewCrawler } from "./_lib/crawlers.js";
import {
  loadShare,
  roundToMinute,
  safePath,
  type ShareKind,
} from "./_lib/loadShare.js";
import { renderShareHtml } from "./_lib/shareHtml.js";
import {
  buildHomeMeta,
  buildLotMeta,
  buildSaleMeta,
  type ShareMeta,
} from "./_lib/shareMeta.js";
import { siteOrigin } from "./_lib/siteOrigin.js";

const CACHE_CONTROL =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=3600";

/**
 * Reads the page kind from the query string.
 *
 * @param raw - The `kind` value
 * @returns A known kind, home by default
 */
function parseKind(raw: string | null): ShareKind {
  return raw === "lot" || raw === "sale" ? raw : "home";
}

/**
 * Serves the crawler-facing HTML of a page (Vercel rewrites crawlers here).
 * Browsers that land here are redirected to the real page. Any failure falls
 * back to the home tags.
 *
 * @param request - The incoming request
 * @returns The response
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = safePath(url.searchParams.get("path"));
  if (!isPreviewCrawler(request.headers.get("user-agent"))) {
    return new Response(null, { status: 302, headers: { Location: path } });
  }
  const origin = siteOrigin();
  const now = roundToMinute(Date.now());
  let meta: ShareMeta;
  try {
    const kind = parseKind(url.searchParams.get("kind"));
    const loaded = await loadShare(kind, url.searchParams.get("id"), now);
    if (loaded.kind === "lot") {
      meta = buildLotMeta(loaded.data, path, now, origin);
    } else if (loaded.kind === "sale") {
      meta = buildSaleMeta(loaded.data, path, now, origin);
    } else {
      meta = buildHomeMeta(loaded.data, path, now, origin);
    }
  } catch {
    meta = buildHomeMeta(null, path, now, origin);
  }
  return new Response(renderShareHtml(meta), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
