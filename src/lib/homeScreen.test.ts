import { afterEach, describe, expect, it, vi } from "vitest";

import {
  browserNeedsHomeScreenInstall,
  needsHomeScreenInstall,
} from "./homeScreen";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36";

describe("needsHomeScreenInstall", () => {
  it("is true for an iPhone tab", () => {
    expect(
      needsHomeScreenInstall({
        userAgent: IPHONE,
        maxTouchPoints: 5,
        standalone: false,
      })
    ).toBe(true);
  });

  it("is false once installed to the Home Screen", () => {
    expect(
      needsHomeScreenInstall({
        userAgent: IPHONE,
        maxTouchPoints: 5,
        standalone: true,
      })
    ).toBe(false);
  });

  it("treats an iPad that reports a Mac user agent as iOS", () => {
    expect(
      needsHomeScreenInstall({
        userAgent: MAC,
        maxTouchPoints: 5,
        standalone: false,
      })
    ).toBe(true);
  });

  it("is false for a real Mac and for Android", () => {
    expect(
      needsHomeScreenInstall({
        userAgent: MAC,
        maxTouchPoints: 0,
        standalone: false,
      })
    ).toBe(false);
    expect(
      needsHomeScreenInstall({
        userAgent: ANDROID,
        maxTouchPoints: 5,
        standalone: false,
      })
    ).toBe(false);
  });
});

describe("browserNeedsHomeScreenInstall", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the navigator and the display mode", () => {
    vi.stubGlobal("navigator", { userAgent: IPHONE, maxTouchPoints: 5 });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    expect(browserNeedsHomeScreenInstall()).toBe(true);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    expect(browserNeedsHomeScreenInstall()).toBe(false);
  });

  it("honours navigator.standalone", () => {
    vi.stubGlobal("navigator", {
      userAgent: IPHONE,
      maxTouchPoints: 5,
      standalone: true,
    });
    expect(browserNeedsHomeScreenInstall()).toBe(false);
  });
});
