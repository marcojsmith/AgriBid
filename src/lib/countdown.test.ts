import { describe, it, expect } from "vitest";

import { countdownTone, formatRemaining } from "./countdown";

describe("countdownTone", () => {
  it("is neutral at or above one hour, amber below, red below two minutes", () => {
    expect(countdownTone(3_600_000)).toBe("neutral");
    expect(countdownTone(3_599_999)).toBe("warn");
    expect(countdownTone(120_000)).toBe("warn");
    expect(countdownTone(119_999)).toBe("urgent");
    expect(countdownTone(0)).toBe("neutral");
  });
});

describe("formatRemaining", () => {
  it("shows minutes and seconds under one hour", () => {
    expect(formatRemaining(5_000)).toBe("0m 5s");
    expect(formatRemaining(2_530_000)).toBe("42m 10s");
    expect(formatRemaining(3_599_000)).toBe("59m 59s");
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
