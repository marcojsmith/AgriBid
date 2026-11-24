/**
 * Where the machine stands: "Malmesbury, Western Cape". A trailing country
 * ("ZA", "South Africa") on the stored town is dropped. Has no imports so the
 * Vercel share function can use it.
 *
 * @param location - The stored town or place
 * @param province - The province's display name, if known
 * @returns The place text, or an empty string
 */
export function lotPlace(
  location?: string | null,
  province?: string | null
): string {
  const town = (location ?? "")
    .replace(/,\s*(ZA|South Africa)\s*$/i, "")
    .trim();
  return [town, province?.trim()].filter((part) => !!part).join(", ");
}
