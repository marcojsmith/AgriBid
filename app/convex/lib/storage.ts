/**
 * Storage utilities for managing auction-related files.
 */

import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

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
 * @param images - The images object or legacy array containing storage IDs
 */
export async function deleteAuctionImages(
  ctx: MutationCtx,
  images: AuctionImages | Doc<"auctions">["images"]
): Promise<void> {
  let storageIds: string[] = [];

  if (Array.isArray(images)) {
    storageIds = (images as string[]).filter(Boolean);
  } else if (images && typeof images === "object") {
    const imagesObj = images as AuctionImages;
    storageIds = [
      imagesObj.front,
      imagesObj.engine,
      imagesObj.cabin,
      imagesObj.rear,
      ...(imagesObj.additional || []),
    ].filter((id): id is string => !!id);
  }

  if (storageIds.length === 0) return;

  await Promise.allSettled(
    storageIds.map(async (storageId) => {
      try {
        await ctx.storage.delete(storageId as Id<"_storage">);
      } catch (e) {
        console.warn(`Failed to delete storage item: ${storageId}`, e);
      }
    })
  );
}
