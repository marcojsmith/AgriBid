import type { QueryCtx } from "./_generated/server";

/**
 * Resolve a storage ID to a URL.
 *
 * Note: Caching is handled by Convex's built-in query result caching mechanism.
 * Storage URLs from Convex are long-lived and deterministic, so repeated calls
 * within the same query execution are automatically cached by Convex.
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

  const url = await storage.getUrl(storageId);
  return url ?? undefined;
}
