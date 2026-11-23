import { describe, it, expect } from "vitest";

import { countdownTone, formatClosesIn, formatRemaining } from "./countdown";

describe("countdownTone", () => {
  it("is neutral at or above one hour, amber below, red below ten minutes", () => {
    expect(countdownTone(3_600_000)).toBe("neutral");
    expect(countdownTone(3_599_999)).toBe("warn");
    expect(countdownTone(600_000)).toBe("warn");
    expect(countdownTone(599_999)).toBe("urgent");
    expect(countdownTone(0)).toBe("neutral");
  });
});

describe("formatRemaining", () => {
  it("shows minutes and seconds only in the final 10 minutes", () => {
    expect(formatRemaining(5_000)).toBe("0m 5s");
    expect(formatRemaining(112_000)).toBe("1m 52s");
    expect(formatRemaining(599_000)).toBe("9m 59s");
  });

  it("shows minutes only from 10 minutes to one hour", () => {
    expect(formatRemaining(600_000)).toBe("10m");
    expect(formatRemaining(2_530_000)).toBe("42m");
    expect(formatRemaining(3_599_000)).toBe("59m");
  });

  it("shows hours and minutes from one hour, with no seconds", () => {
    expect(formatRemaining(3_600_000)).toBe("1h 0m");
    expect(formatRemaining(3_661_000)).toBe("1h 1m");
    expect(formatRemaining(85_080_000)).toBe("23h 38m");
  });

  it("shows days and hours from one day, with no minutes", () => {
    expect(formatRemaining(86_400_000)).toBe("1d 0h");
    expect(formatRemaining(90_061_000)).toBe("1d 1h");
    expect(formatRemaining(518_400_000 - 1000)).toBe("5d 23h");
  });
});

describe("formatClosesIn", () => {
  it("prefixes the relative time", () => {
    expect(formatClosesIn(2 * 86_400_000 + 3 * 3_600_000)).toBe(
      "Closes in 2d 3h"
    );
    expect(formatClosesIn(112_000)).toBe("Closes in 1m 52s");
  });

  it("says Closed once the time has passed or is invalid", () => {
    expect(formatClosesIn(0)).toBe("Closed");
    expect(formatClosesIn(-5)).toBe("Closed");
    expect(formatClosesIn(Number.NaN)).toBe("Closed");
  });
});
