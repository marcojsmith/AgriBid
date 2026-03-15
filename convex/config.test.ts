import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Config Coverage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("getEnv", () => {
    it("should return the value of an environment variable", async () => {
      vi.stubEnv("TEST_VAR", "test-value");
      const { getEnv } = await import("./config");
      expect(getEnv("TEST_VAR")).toBe("test-value");
      vi.unstubAllEnvs();
    });

    it("should return undefined if variable is not set", async () => {
      const { getEnv } = await import("./config");
      expect(getEnv("NON_EXISTENT_VAR")).toBeUndefined();
    });
  });

  describe("requireEnv", () => {
    it("should return the value if set", async () => {
      vi.stubEnv("REQUIRED_VAR", "required-value");
      const { requireEnv } = await import("./config");
      expect(requireEnv("REQUIRED_VAR")).toBe("required-value");
      vi.unstubAllEnvs();
    });

    it("should throw if variable is missing", async () => {
      const { requireEnv } = await import("./config");
      expect(() => requireEnv("MISSING_VAR")).toThrow(
        "Missing MISSING_VAR environment variable."
      );
    });
  });

  describe("isOriginAllowed", () => {
    it("should return false for null/undefined origin", async () => {
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed(null)).toBe(false);
      expect(isOriginAllowed(undefined)).toBe(false);
    });

    it("should allow exact matches", async () => {
      vi.stubEnv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,https://agribid.app"
      );
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed("http://localhost:5173")).toBe(true);
      expect(isOriginAllowed("https://agribid.app")).toBe(true);
      vi.unstubAllEnvs();
    });

    it("should allow suffix matches with dot prefix", async () => {
      vi.stubEnv("ALLOWED_ORIGINS", ".vercel.app");
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed("https://test.vercel.app")).toBe(true);
      expect(isOriginAllowed("https://another.sub.vercel.app")).toBe(true);
      expect(isOriginAllowed("https://vercel.app")).toBe(true);
      expect(isOriginAllowed("https://other-app.com")).toBe(false);
      vi.unstubAllEnvs();
    });

    it("should handle plain hostname entries", async () => {
      vi.stubEnv("ALLOWED_ORIGINS", "localhost,example.com");
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed("localhost")).toBe(true);
      expect(isOriginAllowed("example.com")).toBe(true);
      expect(isOriginAllowed("other.com")).toBe(false);
      vi.unstubAllEnvs();
    });

    it("should handle full URL entries correctly", async () => {
      vi.stubEnv("ALLOWED_ORIGINS", "https://agribid.app:8080");
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed("https://agribid.app:8080")).toBe(true);
      expect(isOriginAllowed("https://agribid.app")).toBe(false); // Different port
      expect(isOriginAllowed("http://agribid.app:8080")).toBe(false); // Different protocol
      vi.unstubAllEnvs();
    });

    it("should return false if allowed URL is invalid", async () => {
      // This specifically hits the catch block inside the some() iterator
      vi.stubEnv("ALLOWED_ORIGINS", "http://[invalid-url]");
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed("http://localhost:5173")).toBe(false);
      vi.unstubAllEnvs();
    });

    it("should return false if allowed is http but origin is just a hostname", async () => {
      vi.stubEnv("ALLOWED_ORIGINS", "https://agribid.app");
      const { isOriginAllowed } = await import("./config");
      expect(isOriginAllowed("agribid.app")).toBe(false);
      vi.unstubAllEnvs();
    });
  });

  describe("COMMISSION_RATE", () => {
    it("should use env value if valid", async () => {
      vi.stubEnv("COMMISSION_RATE", "0.1");
      const { COMMISSION_RATE } = await import("./config");
      expect(COMMISSION_RATE).toBe(0.1);
      vi.unstubAllEnvs();
    });

    it("should fallback to 0.05 if env is missing", async () => {
      const { COMMISSION_RATE } = await import("./config");
      expect(COMMISSION_RATE).toBe(0.05);
    });

    it("should fallback to 0.05 if env is invalid", async () => {
      vi.stubEnv("COMMISSION_RATE", "not-a-number");
      const { COMMISSION_RATE } = await import("./config");
      expect(COMMISSION_RATE).toBe(0.05);
      vi.unstubAllEnvs();
    });
  });
});
