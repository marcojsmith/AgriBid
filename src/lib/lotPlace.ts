/**
 * Where the machine stands: "Malmesbury, Western Cape". A trailing country
 * ("ZA", "South Africa") on the stored town is dropped, and the province is
 * not repeated when the town already ends with it. Has no imports so the
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
  const label = province?.trim() ?? "";
  // The stored town often already ends with the province ("Marble Hall, Limpopo").
  const repeated =
    label !== "" &&
    (town.toLowerCase() === label.toLowerCase() ||
      town.toLowerCase().endsWith(`, ${label.toLowerCase()}`));
  return [town, repeated ? "" : label].filter((part) => !!part).join(", ");
}
