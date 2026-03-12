import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getAuthUser,
  requireAuth,
  getCallerRole,
  requireAdmin,
  requireVerified,
  requireVerifiedSeller,
  UnauthorizedError,
  VERIFIED_REQUIRED_MESSAGE,
} from "./auth";
import { authComponent } from "../auth";
import type { QueryCtx } from "../_generated/server";

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

describe("Auth Utilities", () => {
  interface MockCtx {
    auth: { getUserIdentity: ReturnType<typeof vi.fn> };
    db: {
      get: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
      system: unknown;
      normalizeId: ReturnType<typeof vi.fn>;
    };
    storage: unknown;
    scheduler: unknown;
    runMutation: unknown;
    runQuery: unknown;
    runAction: unknown;
    queryMock: {
      withIndex: ReturnType<typeof vi.fn>;
      unique: ReturnType<typeof vi.fn>;
    };
  }
  let mockCtx: MockCtx;

  beforeEach(() => {
    vi.resetAllMocks();
    const queryMock = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn(),
    };
    mockCtx = {
      auth: {
        getUserIdentity: vi.fn(),
      },
      db: {
        get: vi.fn(),
        query: vi.fn(() => queryMock),
        system: {},
        normalizeId: vi.fn((_table: string, id: string) => id),
      },
      storage: {},
      scheduler: {},
      runMutation: {},
      runQuery: {},
      runAction: {},
      queryMock,
    };
  });

  describe("getAuthUser", () => {
    it("should return null if no identity", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      const user = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(user).toBeNull();
    });

    it("should return null if identity has no subject", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ name: "Guest" });
      const user = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(user).toBeNull();
    });

    it("should return user from authComponent if successful", async () => {
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      const user = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(user).toEqual(mockUser);
    });

    it("should fallback to manual lookup if authComponent fails with ArgumentValidationError", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("ArgumentValidationError: ...")
      );

      const mockUserRecord = {
        _id: "u1",
        userId: "user_1",
        email: "test@example.com",
      };
      mockCtx.db.get.mockResolvedValue(mockUserRecord);

      const user = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(user).toEqual(
        expect.objectContaining({
          _id: "u1",
          userId: "user_1",
          email: "test@example.com",
        })
      );
    });
  });

  describe("requireAuth", () => {
    it("should return user if authenticated", async () => {
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      const user = await requireAuth(mockCtx as unknown as QueryCtx);
      expect(user).toEqual(mockUser);
    });

    it("should throw if not authenticated", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      await expect(requireAuth(mockCtx as unknown as QueryCtx)).rejects.toThrow(
        "Not authenticated"
      );
    });
  });

  describe("getCallerRole", () => {
    it("should return role from profile", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      mockCtx.queryMock.unique.mockResolvedValue({
        userId: "u1",
        role: "seller",
      });

      const role = await getCallerRole(mockCtx as unknown as QueryCtx);
      expect(role).toBe("seller");
    });

    it("should return null if user not found", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      const role = await getCallerRole(mockCtx as unknown as QueryCtx);
      expect(role).toBeNull();
    });
  });

  describe("requireAdmin", () => {
    it("should succeed if user is admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      mockCtx.queryMock.unique.mockResolvedValue({
        userId: "u1",
        role: "admin",
      });

      const user = await requireAdmin(mockCtx as unknown as QueryCtx);
      expect(user).toBeDefined();
    });

    it("should throw if user is not admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      mockCtx.queryMock.unique.mockResolvedValue({
        userId: "u1",
        role: "buyer",
      });

      await expect(
        requireAdmin(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("requireVerified", () => {
    it("should succeed if user is verified", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      mockCtx.queryMock.unique.mockResolvedValue({
        userId: "u1",
        isVerified: true,
      });

      const result = await requireVerified(mockCtx as unknown as QueryCtx);
      expect(result.profile.isVerified).toBe(true);
    });

    it("should throw if user is not verified", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      mockCtx.queryMock.unique.mockResolvedValue({
        userId: "u1",
        isVerified: false,
      });

      await expect(
        requireVerified(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow(VERIFIED_REQUIRED_MESSAGE);
    });
  });

  describe("requireVerifiedSeller", () => {
    it("should succeed if verified seller", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      mockCtx.queryMock.unique.mockResolvedValue({
        userId: "u1",
        isVerified: true,
        role: "seller",
      });

      const result = await requireVerifiedSeller(
        mockCtx as unknown as QueryCtx
      );
      expect(result.profile.role).toBe("seller");
    });

    it("should succeed if verified admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      mockCtx.queryMock.unique.mockResolvedValue({
        userId: "u1",
        isVerified: true,
        role: "admin",
      });

      const result = await requireVerifiedSeller(
        mockCtx as unknown as QueryCtx
      );
      expect(result.profile.role).toBe("admin");
    });

    it("should throw if buyer", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      const mockUser = {
        _id: "u1",
        _creationTime: Date.now(),
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        emailVerified: true,
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>;
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser);

      mockCtx.queryMock.unique.mockResolvedValue({
        userId: "u1",
        isVerified: true,
        role: "buyer",
      });

      await expect(
        requireVerifiedSeller(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow("Seller account required");
    });
  });
});
