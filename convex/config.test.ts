import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Config Utilities", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  describe("getEnv", () => {
    it("should return value if set", async () => {
      vi.stubEnv("TEST_VAR", "test-value");
      const { getEnv } = await import("./config");
      expect(getEnv("TEST_VAR")).toBe("test-value");
    });
  });

  describe("requireEnv", () => {
    it("should return value if set", async () => {
      vi.stubEnv("REQUIRED_VAR", "required-value");
      const { requireEnv } = await import("./config");
      expect(requireEnv("REQUIRED_VAR")).toBe("required-value");
    });

    it("should throw if not set", async () => {
      const { requireEnv } = await import("./config");
      expect(() => requireEnv("MISSING_VAR")).toThrow("Missing MISSING_VAR environment variable.");
    });
  });

  describe("isOriginAllowed", () => {
    it("should return false for null or undefined", async () => {
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed(null)).toBe(false);
      expect(isOriginAllowed(undefined)).toBe(false);
    });

    it("should match exact origins", async () => {
      vi.stubEnv("ALLOWED_ORIGINS", "http://localhost:5173,https://agribid.com");
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed("http://localhost:5173")).toBe(true);
      expect(isOriginAllowed("https://agribid.com")).toBe(true);
      expect(isOriginAllowed("http://malicious.com")).toBe(false);
    });

    it("should match wildcards with dot prefix", async () => {
      vi.stubEnv("ALLOWED_ORIGINS", ".vercel.app,localhost");
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed("https://test.vercel.app")).toBe(true);
      expect(isOriginAllowed("https://sub.test.vercel.app")).toBe(true);
      expect(isOriginAllowed("vercel.app")).toBe(true);
      expect(isOriginAllowed("localhost")).toBe(true);
      expect(isOriginAllowed("other.app")).toBe(false);
    });

    it("should match URL origins correctly", async () => {
      vi.stubEnv("ALLOWED_ORIGINS", "http://localhost:3000");
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed("http://localhost:3000")).toBe(true);
      expect(isOriginAllowed("http://localhost:3000/some/path")).toBe(true);
      expect(isOriginAllowed("https://localhost:3000")).toBe(false); // different protocol
      expect(isOriginAllowed("http://localhost:3001")).toBe(false); // different port
    });
  });
});
