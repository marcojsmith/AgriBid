import { describe, it, expect } from "vitest";

import { formatCurrency } from "./currency";

/**
 * Normalizes the currency string by replacing non-breaking spaces with regular spaces
 * and ensuring consistent decimal/thousand separators for testing.
 *
 * @param str - The string to normalize
 * @returns The normalized string
 */
function normalize(str: string): string {
  // Replace NBSP with space, and convert comma decimal separator to dot
  return str.replace(/\u00a0/g, " ").replace(",", ".");
}

describe("formatCurrency", () => {
  it("formats whole numbers", () => {
    // We check for the numeric parts because the currency symbol/position can vary by environment
    const result = normalize(formatCurrency(1000));
    expect(result).toMatch(/1\s*000\.00/);
  });

  it("formats decimal numbers", () => {
    const result = normalize(formatCurrency(1234.56));
    expect(result).toMatch(/1\s*234\.56/);
  });

  it("formats zero", () => {
    const result = normalize(formatCurrency(0));
    expect(result).toMatch(/0\.00/);
  });

  it("formats large numbers with commas", () => {
    const result = normalize(formatCurrency(1000000));
    expect(result).toMatch(/1\s*000\s*000\.00/);
  });

  it("rounds to 2 decimal places", () => {
    const result = normalize(formatCurrency(10.999));
    expect(result).toMatch(/11\.00/);
  });
});
