import { describe, it, expect } from "vitest";

import { formatSastDate, formatSastDay } from "./dates";

describe("formatSastDate", () => {
  it("formats a UTC time as South African time (+2h) with no suffix", () => {
    expect(formatSastDate(Date.UTC(2025, 10, 22, 8, 0))).toBe(
      "Sat 22 Nov, 10:00"
    );
  });

  it("rolls over midnight into the next day", () => {
    expect(formatSastDate(Date.UTC(2026, 0, 1, 23, 5))).toBe(
      "Fri 2 Jan, 01:05"
    );
  });

  it("ignores seconds", () => {
    expect(formatSastDate(Date.UTC(2026, 5, 3, 10, 30, 59))).toBe(
      "Wed 3 Jun, 12:30"
    );
  });

  it("returns an empty string for non-finite input", () => {
    expect(formatSastDate(Number.NaN)).toBe("");
  });
});

describe("formatSastDay", () => {
  it("formats a calendar date in", () => {
    expect(formatSastDay(Date.UTC(2026, 10, 21, 9, 0))).toBe("21 Nov 2026");
  });

  it("rolls over midnight and the year", () => {
    expect(formatSastDay(Date.UTC(2025, 11, 31, 22, 30))).toBe("1 Jan 2026");
  });

  it("returns an empty string for non-finite input", () => {
    expect(formatSastDay(Number.NaN)).toBe("");
  });
});
