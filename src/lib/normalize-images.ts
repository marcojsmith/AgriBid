import type { ListingImages } from "@/components/listing-wizard/types";

/**
 * Normalizes ListingImages by ensuring the additional array is present,
 * trimming URL strings, and filtering out empty or whitespace-only entries.
 *
 * @param images - The raw images object from form state or database
 * @returns A normalized ListingImages object
 */
export function normalizeListingImages(images: unknown): ListingImages {
  if (Array.isArray(images)) {
    return {
      front: typeof images[0] === "string" ? (images[0] as string).trim() : "",
      additional: images
        .slice(1)
        .filter(
          (url: unknown) => typeof url === "string" && url.trim().length > 0
        )
        .map((url: unknown) => (url as string).trim()),
    };
  }

  if (images && typeof images === "object" && !Array.isArray(images)) {
    const imagesObj = images as Record<string, unknown>;
    return {
      front: typeof imagesObj.front === "string" ? imagesObj.front.trim() : "",
      engine:
        typeof imagesObj.engine === "string" ? imagesObj.engine.trim() : "",
      cabin: typeof imagesObj.cabin === "string" ? imagesObj.cabin.trim() : "",
      rear: typeof imagesObj.rear === "string" ? imagesObj.rear.trim() : "",
      additional: Array.isArray(imagesObj.additional)
        ? imagesObj.additional
            .filter(
              (url: unknown) => typeof url === "string" && url.trim().length > 0
            )
            .map((url: unknown) => (url as string).trim())
        : [],
    };
  }

  return { additional: [] };
}
