/**
 * Storage utilities for managing auction-related files.
 */

import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/**
 * Normalizes images object to ensure additional array exists.
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
    additional: images.additional || [],
  };
}

/**
 * Type for auction images in the database.
 */
type AuctionImages = {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
};

/**
 * Deletes all storage items associated with auction images.
 * Silently handles missing or already-deleted storage items.
 *
 * @param ctx - Mutation context with storage access
 * @param images - The images object containing storage IDs
 */
export async function deleteAuctionImages(
  ctx: MutationCtx,
  images: AuctionImages | Doc<"auctions">["images"]
): Promise<void> {
  if (Array.isArray(images)) return;

  const storageIds = [
    images.front,
    images.engine,
    images.cabin,
    images.rear,
    ...(images.additional || []),
  ].filter(Boolean) as string[];

  await Promise.allSettled(
    storageIds.map(async (storageId) => {
      try {
        await ctx.storage.delete(storageId);
      } catch (e) {
        console.warn(`Failed to delete storage item: ${storageId}`, e);
      }
    })
  );
}
