import { describe, it, expect, vi, beforeEach } from "vitest";
import { betterAuth } from "better-auth";
import type { GenericCtx } from "@convex-dev/better-auth";

import { getAuthUser, createAuth } from "./auth";
import { authComponent } from "./auth";
import * as config from "./config";
import type { DataModel } from "./_generated/dataModel";

vi.mock("./_generated/server", () => ({
  query: vi.fn((q) => q),
  mutation: vi.fn((m) => m),
}));

vi.mock("./_generated/api", () => ({
  components: {
    auth: {},
  },
}));

vi.mock("@convex-dev/better-auth", () => ({
  createClient: vi.fn(() => ({
    getAuthUser: vi.fn(),
    adapter: vi.fn(() => ({})),
  })),
}));

vi.mock("@convex-dev/better-auth/plugins", () => ({
  convex: vi.fn(() => ({})),
}));

vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({})),
}));

vi.mock("./config", () => ({
  ALLOWED_ORIGINS: ["http://localhost:5173"],
  isOriginAllowed: vi.fn(),
}));

describe("Auth Coverage", () => {
  const mockCtx = {} as unknown as GenericCtx<DataModel>;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.CONVEX_SITE_URL = "https://test.convex.site";
  });

  describe("getAuthUser query", () => {
    it("should return user from authComponent", async () => {
      const mockUser = {
        _id: "u1",
        name: "Test User",
        email: "test@test.com",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
        _creationTime: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      const result = await (
        getAuthUser as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});
      expect(result).toEqual(mockUser);
    });

    it("should return null and log on error (not Unauthenticated)", async () => {
      const error = new Error("DB Fail");
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(error);
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await (
        getAuthUser as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("authComponent.getAuthUser failure:"),
        error
      );
      spy.mockRestore();
    });

    it("should return null without logging for Unauthenticated error", async () => {
      const error = new Error("Unauthenticated");
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(error);
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await (
        getAuthUser as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});
      expect(result).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("createAuth", () => {
    it("should create auth instance with default options", () => {
      createAuth(mockCtx);
      expect(betterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          appName: "AgriBid",
          baseURL: "https://test.convex.site",
          trustedOrigins: ["http://localhost:5173"],
        })
      );
    });

    it("should include origin if allowed", () => {
      vi.mocked(config.isOriginAllowed).mockReturnValue(true);
      createAuth(mockCtx, { origin: "https://allowed.com" });

      expect(betterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          trustedOrigins: ["http://localhost:5173", "https://allowed.com"],
        })
      );
    });

    it("should not include origin if not allowed", () => {
      vi.mocked(config.isOriginAllowed).mockReturnValue(false);
      createAuth(mockCtx, { origin: "https://malicious.com" });

      expect(betterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          trustedOrigins: ["http://localhost:5173"],
        })
      );
    });

    it("should throw if CONVEX_SITE_URL is missing", () => {
      delete process.env.CONVEX_SITE_URL;
      expect(() => createAuth(mockCtx)).toThrow("Missing CONVEX_SITE_URL");
    });

    it("should disable logger if optionsOnly is true", () => {
      createAuth(mockCtx, { optionsOnly: true });
      expect(betterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: { disabled: true },
        })
      );
    });
  });
});
