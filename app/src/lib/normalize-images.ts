/**
 * Normalizes images object to ensure additional array is properly formatted.
 */
export function normalizeListingImages<
  T extends {
    front?: string;
    engine?: string;
    cabin?: string;
    rear?: string;
    additional?: string[] | unknown[];
  },
>(images: T): T & { additional: string[] } {
  return {
    ...images,
    additional: Array.isArray(images.additional)
      ? (images.additional.filter(
          (url) => typeof url === "string" && url.length > 0
        ) as string[])
      : [],
  };
}
