import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Config Coverage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("should return false if allowed URL is invalid in isOriginAllowed", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", "http://[invalid-url]");
    const { isOriginAllowed } = await import("./config");

    expect(isOriginAllowed("http://localhost:5173")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("should return false if origin is parseable but allowed is http and origin is not parseable", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", "http://localhost:5173");
    const { isOriginAllowed } = await import("./config");

    // We need to pass an origin that is NOT a valid URL but isOriginAllowed treats it as hostname
    // But if allowed starts with http, it expects originUrl to be present.
    expect(isOriginAllowed(null)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("should use default COMMISSION_RATE if env is invalid", async () => {
    vi.stubEnv("COMMISSION_RATE", "not-a-number");
    const { COMMISSION_RATE } = await import("./config");

    expect(COMMISSION_RATE).toBe(0.05);
    vi.unstubAllEnvs();
  });
});
