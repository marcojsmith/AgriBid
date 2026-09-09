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
  // Legacy documents may hold null/undefined despite the declared parameter type.
  const legacyImages = images as
    | AuctionImages
    | Doc<"auctions">["images"]
    | null
    | undefined;
  let storageIds: string[] = [];

  if (legacyImages != null && Array.isArray(legacyImages)) {
    storageIds = (legacyImages as string[]).filter(Boolean);
  } else if (legacyImages != null && typeof legacyImages === "object") {
    const imagesObj = legacyImages as AuctionImages;
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
