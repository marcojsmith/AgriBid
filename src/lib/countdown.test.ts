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
  it("drops leading zero units", () => {
    expect(formatRemaining(5_000)).toBe("0m 5s");
    expect(formatRemaining(3_661_000)).toBe("1h 1m 1s");
    expect(formatRemaining(90_061_000)).toBe("1d 1h 1m 1s");
  });
});
