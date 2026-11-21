import { describe, it, expect } from "vitest";

import { formatSastDate } from "./dates";

describe("formatSastDate", () => {
  it("formats a UTC time as SAST (+2h)", () => {
    expect(formatSastDate(Date.UTC(2025, 10, 22, 8, 0))).toBe(
      "Sat 22 Nov, 10:00 SAST"
    );
  });

  it("rolls over midnight into the next day", () => {
    expect(formatSastDate(Date.UTC(2026, 0, 1, 23, 5))).toBe(
      "Fri 2 Jan, 01:05 SAST"
    );
  });

  it("ignores seconds", () => {
    expect(formatSastDate(Date.UTC(2026, 5, 3, 10, 30, 59))).toBe(
      "Wed 3 Jun, 12:30 SAST"
    );
  });

  it("returns an empty string for non-finite input", () => {
    expect(formatSastDate(Number.NaN)).toBe("");
  });
});
