import { describe, expect, it } from "vitest";

import {
  DEFAULT_VAT_RATE_PCT,
  calculateBuyerTotal,
  parseVatRate,
  premiumFromRate,
} from "./vat";

describe("calculateBuyerTotal", () => {
  it("applies VAT to bid plus premium", () => {
    expect(
      calculateBuyerTotal({ bid: 100_000, premium: 10_000, vatRatePct: 15 })
    ).toEqual({ bid: 100_000, premium: 10_000, vat: 16_500, total: 126_500 });
  });

  it("works without a premium", () => {
    expect(
      calculateBuyerTotal({ bid: 1_000, premium: 0, vatRatePct: 15 })
    ).toEqual({ bid: 1_000, premium: 0, vat: 150, total: 1_150 });
  });

  it("adds no VAT at a 0% rate", () => {
    expect(
      calculateBuyerTotal({ bid: 1_000, premium: 50, vatRatePct: 0 })
    ).toEqual({ bid: 1_000, premium: 50, vat: 0, total: 1_050 });
  });

  it("rounds to whole rand and keeps the lines summing to the total", () => {
    const result = calculateBuyerTotal({
      bid: 1_001,
      premium: 50.4,
      vatRatePct: 15,
    });
    expect(result).toEqual({ bid: 1_001, premium: 50, vat: 158, total: 1_209 });
    expect(result.bid + result.premium + result.vat).toBe(result.total);
  });

  it("rounds a half rand of premium up", () => {
    expect(
      calculateBuyerTotal({ bid: 100, premium: 0.5, vatRatePct: 0 }).premium
    ).toBe(1);
  });

  it("treats negative and non-finite inputs as zero", () => {
    expect(
      calculateBuyerTotal({
        bid: Number.NaN,
        premium: -5,
        vatRatePct: Number.POSITIVE_INFINITY,
      })
    ).toEqual({ bid: 0, premium: 0, vat: 0, total: 0 });
  });

  it("clamps the VAT rate to 100%", () => {
    expect(
      calculateBuyerTotal({ bid: 100, premium: 0, vatRatePct: 500 }).vat
    ).toBe(100);
  });
});

describe("parseVatRate", () => {
  it.each([
    ["15", 15],
    [" 7.5 ", 7.5],
    ["0", 0],
    ["100", 100],
  ])("accepts %s", (raw, expected) => {
    expect(parseVatRate(raw)).toBe(expected);
  });

  it.each(["", "  ", "abc", "-1", "100.5", "Infinity"])("rejects %j", (raw) => {
    expect(parseVatRate(raw)).toBeNull();
  });
});

describe("premiumFromRate", () => {
  it("multiplies the stored fractional rate onto the bid", () => {
    expect(premiumFromRate(200_000, 0.05)).toBeCloseTo(10_000);
  });

  it("feeds calculateBuyerTotal", () => {
    const premium = premiumFromRate(200_000, 0.05);
    expect(
      calculateBuyerTotal({ bid: 200_000, premium, vatRatePct: 15 }).total
    ).toBe(241_500);
  });
});

describe("DEFAULT_VAT_RATE_PCT", () => {
  it("is the South African standard rate", () => {
    expect(DEFAULT_VAT_RATE_PCT).toBe(15);
  });
});
