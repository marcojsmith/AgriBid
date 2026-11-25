import { describe, expect, it } from "vitest";

import { addBusinessDays } from "./businessDays";

/**
 * SAST (UTC+2) wall-clock time as epoch ms.
 *
 * @param y - Year
 * @param m - Month (1-12)
 * @param d - Day of month
 * @param h - Hour in SAST
 * @param min - Minute
 * @returns Epoch milliseconds
 */
const sast = (y: number, m: number, d: number, h = 11, min = 0): number =>
  Date.UTC(y, m - 1, d, h - 2, min);

describe("addBusinessDays", () => {
  it("Tue 24 Nov 2026 11:00 + 2 = Thu 26 Nov 11:00", () => {
    expect(addBusinessDays(sast(2026, 11, 24), 2)).toBe(sast(2026, 11, 26));
  });

  it("Wed + 2 = Fri", () => {
    expect(addBusinessDays(sast(2026, 11, 25), 2)).toBe(sast(2026, 11, 27));
  });

  it("Thu + 2 = Mon", () => {
    expect(addBusinessDays(sast(2026, 11, 26), 2)).toBe(sast(2026, 11, 30));
  });

  it("Fri 11:00 + 2 = Tue 11:00", () => {
    expect(addBusinessDays(sast(2026, 11, 27), 2)).toBe(sast(2026, 12, 1));
  });

  it("Sat + 2 = Tue, same time of day", () => {
    expect(addBusinessDays(sast(2026, 11, 28, 15, 30), 2)).toBe(
      sast(2026, 12, 1, 15, 30)
    );
  });

  it("Sun + 2 = Tue", () => {
    expect(addBusinessDays(sast(2026, 11, 29), 2)).toBe(sast(2026, 12, 1));
  });

  it("counts in SAST: Fri 23:30 UTC is already Saturday 01:30 in SAST", () => {
    // Fri 27 Nov 23:30 UTC = Sat 28 Nov 01:30 SAST -> + 2 = Tue 1 Dec 01:30 SAST
    // = Mon 30 Nov 23:30 UTC.
    expect(addBusinessDays(Date.UTC(2026, 10, 27, 23, 30), 2)).toBe(
      Date.UTC(2026, 10, 30, 23, 30)
    );
  });

  it("zero days returns the same instant", () => {
    const t = sast(2026, 11, 28);
    expect(addBusinessDays(t, 0)).toBe(t);
  });

  it("negative or fractional days are clamped to whole non-negative days", () => {
    const t = sast(2026, 11, 24);
    expect(addBusinessDays(t, -3)).toBe(t);
    expect(addBusinessDays(t, 2.9)).toBe(sast(2026, 11, 26));
  });

  it("five business days is one calendar week", () => {
    expect(addBusinessDays(sast(2026, 11, 24), 5)).toBe(sast(2026, 12, 1));
  });
});
