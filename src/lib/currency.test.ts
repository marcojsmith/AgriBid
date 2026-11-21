import { describe, it, expect } from "vitest";

import { formatCurrency, formatNumber, formatRand } from "./currency";

describe("formatCurrency", () => {
  it("formats whole numbers", () => {
    expect(formatCurrency(1000)).toBe("R 1 000,00");
  });

  it("formats decimal numbers", () => {
    expect(formatCurrency(1234.56)).toBe("R 1 234,56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("R 0,00");
  });

  it("formats large numbers with grouping", () => {
    expect(formatCurrency(50000)).toBe("R 50 000,00");
  });

  it("formats millions with repeated grouping", () => {
    expect(formatCurrency(1000000)).toBe("R 1 000 000,00");
  });

  it("rounds to 2 decimal places", () => {
    expect(formatCurrency(10.999)).toBe("R 11,00");
  });

  it("regroups digits after rounding carries over", () => {
    expect(formatCurrency(999.999)).toBe("R 1 000,00");
  });

  it("formats values below one rand", () => {
    expect(formatCurrency(0.5)).toBe("R 0,50");
  });

  it("prefixes negative amounts with a minus sign", () => {
    expect(formatCurrency(-100)).toBe("-R 100,00");
  });
});

describe("formatNumber", () => {
  it("groups large whole numbers", () => {
    expect(formatNumber(150000)).toBe("150 000");
  });

  it("leaves the fractional part as-is without forcing decimals", () => {
    expect(formatNumber(1234.5)).toBe("1 234.5");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats small numbers without grouping", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("groups long fractional numbers correctly", () => {
    expect(formatNumber(1234567.891)).toBe("1 234 567.891");
  });
});

describe("formatRand", () => {
  const N = " ";
  it("groups with narrow no-break spaces and drops cents", () => {
    expect(formatRand(200000)).toBe(`R${N}200${N}000`);
  });
  it("rounds to the nearest rand", () => {
    expect(formatRand(1234.5)).toBe(`R${N}1${N}235`);
    expect(formatRand(0.4)).toBe(`R${N}0`);
  });
  it("handles negatives and avoids -R 0", () => {
    expect(formatRand(-1500)).toBe(`-R${N}1${N}500`);
    expect(formatRand(-0.2)).toBe(`R${N}0`);
  });
});
