/**
 * Normalises a South African phone number to E.164 (`+27XXXXXXXXX`).
 *
 * Accepts `0XXXXXXXXX`, `27XXXXXXXXX` and `+27XXXXXXXXX`, ignoring spaces,
 * dashes, dots and brackets. The first of the nine national digits must be 1-8.
 *
 * @param raw - The number as typed
 * @returns The `+27` number, or null when it is not a valid SA number
 */
export function normalizeSaPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-.()]/g, "");
  const match = /^(?:\+27|27|0)([1-8]\d{8})$/.exec(cleaned);
  return match?.[1] ? `+27${match[1]}` : null;
}
