import { QueryCtx } from "./_generated/server";

const URL_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const urlCache = new Map<string, CacheEntry>();

/**
 * Resolve a storage ID to a URL, using an in-memory cache to reduce storage calls.
 * 
 * @param storage - The database storage object
 * @param storageId - The storage ID to resolve
 * @returns The resolved URL or undefined
 */
export async function resolveUrlCached(
  storage: QueryCtx["storage"],
  storageId: string | undefined
): Promise<string | undefined> {
  if (!storageId) return undefined;
  if (storageId.startsWith("http")) return storageId;

  const now = Date.now();
  const cached = urlCache.get(storageId);

  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  const url = await storage.getUrl(storageId);
  if (url) {
    urlCache.set(storageId, {
      url,
      expiresAt: now + URL_CACHE_TTL,
    });
    return url;
  }

  return undefined;
}
