/**
 * Groups digit characters with an ASCII space every three digits from the right.
 *
 * @param digits - Digit characters only (no sign, no decimal separator)
 * @returns The grouped digit string (e.g., "1 234 567")
 */
function groupThousands(digits: string): string {
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return groups.join(" ");
}

/**
 * Formats a numeric value as a plain number with space-grouped thousands.
 *
 * Deterministic across platforms and ICU builds: no Intl/locale dependencies.
 * The fractional part (if present) is left as-is and only the integer part is
 * grouped.
 *
 * @param amount - The numeric value to format
 * @returns The grouped number string (e.g., "150 000" or "1 234.5")
 */
export function formatNumber(amount: number): string {
  const raw = String(amount);
  const dotIndex = raw.indexOf(".");
  if (dotIndex === -1) {
    return groupThousands(raw);
  }
  return `${groupThousands(raw.slice(0, dotIndex))}.${raw.slice(dotIndex + 1)}`;
}

/**
 * Formats a numeric value as ZAR currency (South African Rand).
 *
 * Output is deterministic across platforms and ICU builds (no Intl/locale
 * dependencies): an ASCII space is used as the thousands separator and a comma
 * as the decimal separator, matching the en-ZA convention used throughout the
 * app's UI. The value is always rendered with exactly 2 decimal places.
 *
 * @param amount - The numeric value to format
 * @returns A deterministic currency string (e.g., "R 1 234,56"); negative
 *   amounts are prefixed with "-" before the symbol (e.g., "-R 100,00")
 */
export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const [integerPart, fractionalPart = ""] = Math.abs(amount)
    .toFixed(2)
    .split(".");
  return `${sign}R ${groupThousands(integerPart)},${fractionalPart}`;
}

const NBSP = " ";

/**
 * Formats a numeric value as whole Rand for display: `R 200 000`.
 *
 * Uses no-break spaces (U+00A0) for both the symbol gap and the
 * thousands groups so a price never wraps, and drops cents (rounded to the
 * nearest rand). Deterministic: no Intl/locale dependencies. Use this for
 * display of bids, prices and fees; `formatCurrency` keeps cents for
 * statements.
 *
 * @param amount - The numeric value in rand
 * @returns The display string (e.g. "R 200 000"); negatives are "-R 100"
 */
export function formatRand(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  const sign = amount < 0 && rounded !== 0 ? "-" : "";
  return `${sign}R${NBSP}${groupThousands(String(rounded)).replace(/ /g, NBSP)}`;
}
