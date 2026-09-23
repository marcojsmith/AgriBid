/**
 * Storage utilities for managing auction-related files.
 */

import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Normalizes images object to ensure additional array exists.
 * @param images - The images object to normalize
 * @param images.front - Optional storage ID of the front image
 * @param images.engine - Optional storage ID of the engine image
 * @param images.cabin - Optional storage ID of the cabin image
 * @param images.rear - Optional storage ID of the rear image
 * @param images.additional - Optional array of additional image storage IDs
 * @returns The normalized images object.
 */
export function normalizeImages(images: {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
}) {
  return {
    ...images,
    additional: images.additional ?? [],
  };
}

/**
 * Type for auction images in the database.
 */
interface AuctionImages {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
}

/**
 * Deletes a storage item, swallowing and logging any error instead of throwing.
 * Used for best-effort cleanup where a failed delete should not block the
 * surrounding mutation (e.g. an already-deleted or missing storage item).
 * @param ctx - Mutation context with storage access
 * @param storageId - The storage ID to delete
 * @param label - Short description used in the warning log on failure
 */
export async function safeDelete(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  label: string
): Promise<void> {
  try {
    await ctx.storage.delete(storageId);
  } catch (e) {
    console.warn(`Failed to delete ${label}: ${storageId}`, e);
  }
}

/**
 * Collects every storage ID referenced by an auction images value, handling
 * both the current object shape and the legacy array shape. Empty entries are
 * dropped.
 * @param images - The images value (object or legacy array) holding storage IDs
 * @returns Array of referenced storage IDs, in insertion order
 */
export function extractImageStorageIds(
  images: AuctionImages | Doc<"lots">["images"] | null | undefined
): string[] {
  if (images != null && Array.isArray(images)) {
    return images.filter(Boolean);
  }

  if (images != null && typeof images === "object") {
    const imagesObj = images as AuctionImages;
    return [
      imagesObj.front,
      imagesObj.engine,
      imagesObj.cabin,
      imagesObj.rear,
      ...(imagesObj.additional ?? []),
    ].filter((id): id is string => !!id);
  }

  return [];
}

/**
 * Deletes all storage items associated with lot images.
 * Silently handles missing or already-deleted storage items.
 *
 * @param ctx - Mutation context with storage access
 * @param images - The images object or legacy array containing storage IDs
 */
export async function deleteAuctionImages(
  ctx: MutationCtx,
  images: AuctionImages | Doc<"lots">["images"]
): Promise<void> {
  const storageIds = extractImageStorageIds(images);
  if (storageIds.length === 0) return;

  await Promise.allSettled(
    storageIds.map((storageId) =>
      safeDelete(ctx, storageId as Id<"_storage">, "storage item")
    )
  );
}
