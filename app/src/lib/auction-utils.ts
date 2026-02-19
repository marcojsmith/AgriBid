// app/src/lib/auction-utils.ts

export interface AuctionImages {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional?: string[];
}

/**
 * Normalizes auction images from various formats into a standard AuctionImages object.
 *
 * @param images - The raw images data (AuctionImages object, string array, or undefined)
 * @returns A standardized AuctionImages object
 */
export function normalizeAuctionImages(
  images: AuctionImages | string[] | undefined,
): AuctionImages {
  if (!images) return { additional: [] };
  if (Array.isArray(images)) {
    return {
      front: images[0],
      additional: images.slice(1),
    };
  }
  return images;
}
