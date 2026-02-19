/**
 * Formats a numeric value as ZAR currency (South African Rand).
 *
 * @param amount - The numeric value to format
 * @returns A string representation of the currency (e.g., "R 1,234.56")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
