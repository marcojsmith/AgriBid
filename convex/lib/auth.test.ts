import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  getAuthUser,
  resolveUserId,
  requireAuth,
  getAuthenticatedUserId,
  getCallerRole,
  requireAdmin,
  getAuthenticatedProfile,
  getAuthWithProfile,
  requireProfile,
  requireVerified,
  requireVerifiedSeller,
  UnauthorizedError,
  VERIFIED_REQUIRED_MESSAGE,
} from "./auth";
import { authComponent } from "../auth";
import type { QueryCtx } from "../_generated/server";
import type { AuthUser } from "../auth";
import type { Id, Doc } from "../_generated/dataModel";

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

describe("Auth Utilities Coverage", () => {
  interface MockCtx {
    auth: { getUserIdentity: ReturnType<typeof vi.fn> };
    db: {
      get: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
    runQuery: ReturnType<typeof vi.fn>;
  }
  let mockCtx: MockCtx;
  let queryMock: {
    withIndex: ReturnType<typeof vi.fn>;
    unique: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    queryMock = {
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
      },
      runQuery: vi.fn(),
    };
  });

  describe("getAuthUser", () => {
    it("should return null if no identity", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      expect(await getAuthUser(mockCtx as unknown as QueryCtx)).toBeNull();
    });

    it("should return null if identity has no subject", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ name: "No Sub" });
      expect(await getAuthUser(mockCtx as unknown as QueryCtx)).toBeNull();
    });

    it("should return user from component if successful", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      const mockUser: AuthUser = {
        _id: "u1" as Id<"profiles">,
        userId: "user1",
        name: "User 1",
        email: "u1@test.com",
        _creationTime: 100,
      };
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );

      const result = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(result).toEqual(mockUser);
    });

    it("should handle ArgumentValidationError and fallback to db.get", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("ArgumentValidationError")
      );

      const mockUserRecord = {
        _id: "s1",
        userId: "user1",
        email: "test@test.com",
      };
      mockCtx.db.get.mockResolvedValue(mockUserRecord);

      const result = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(result?._id).toBe("s1");
      expect(result?.email).toBe("test@test.com");
    });

    it("should handle ArgumentValidationError and fallback to runQuery (adapter)", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("ArgumentValidationError")
      );
      mockCtx.db.get.mockRejectedValue(new Error("Invalid ID")); // Force adapter fallback

      // Setup adapter on mock component
      (authComponent as unknown as { adapter: { findOne: string } }).adapter = {
        findOne: "adapter_find",
      };

      const mockUserRecord = { _id: "s1", userId: "user1" };
      mockCtx.runQuery.mockResolvedValue(mockUserRecord);

      const result = await getAuthUser(mockCtx as unknown as QueryCtx);
      expect(result?._id).toBe("s1");
      expect(mockCtx.runQuery).toHaveBeenCalledWith(
        "adapter_find",
        expect.anything()
      );
    });

    it("should log error and return null on other errors", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Other Error")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(await getAuthUser(mockCtx as unknown as QueryCtx)).toBeNull();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should handle critical identity error", async () => {
      mockCtx.auth.getUserIdentity.mockRejectedValue(new Error("Critical"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(await getAuthUser(mockCtx as unknown as QueryCtx)).toBeNull();
      spy.mockRestore();
    });
  });

  describe("Helper Functions", () => {
    const mockAuthUser: AuthUser = {
      _id: "u1" as Id<"profiles">,
      userId: "user1",
      name: "User 1",
      email: "u1@test.com",
      _creationTime: 100,
    };

    it("requireAuth should throw if no user", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      await expect(requireAuth(mockCtx as unknown as QueryCtx)).rejects.toThrow(
        "Not authenticated"
      );
    });

    it("getAuthenticatedUserId should return ID", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      expect(await getAuthenticatedUserId(mockCtx as unknown as QueryCtx)).toBe(
        "user1"
      );
    });

    it("getAuthenticatedUserId should throw if resolve fails", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      // @ts-expect-error - testing invalid return
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _id: undefined as any,
        userId: null,
      });
      await expect(
        getAuthenticatedUserId(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow("Unable to determine user ID");
    });

    it("getCallerRole should return role", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      queryMock.unique.mockResolvedValue({ role: "buyer" } as Doc<"profiles">);

      expect(await getCallerRole(mockCtx as unknown as QueryCtx)).toBe("buyer");
    });

    it("getCallerRole should return null if no profile or error", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      queryMock.unique.mockResolvedValue(null);
      expect(await getCallerRole(mockCtx as unknown as QueryCtx)).toBeNull();

      queryMock.unique.mockRejectedValue(new Error("DB Error"));
      expect(await getCallerRole(mockCtx as unknown as QueryCtx)).toBeNull();
    });

    it("requireAdmin should throw if not admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      queryMock.unique.mockResolvedValue({ role: "buyer" } as Doc<"profiles">);

      await expect(
        requireAdmin(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow(UnauthorizedError);
    });

    it("requireAdmin should return user if admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      queryMock.unique.mockResolvedValue({ role: "admin" } as Doc<"profiles">);

      expect(await requireAdmin(mockCtx as unknown as QueryCtx)).toEqual(
        mockAuthUser
      );
    });

    it("requireProfile should throw if profile missing", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      queryMock.unique.mockResolvedValue(null);

      await expect(
        requireProfile(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow(ConvexError);
    });

    it("requireVerified should throw if not verified", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      queryMock.unique.mockResolvedValue({
        role: "buyer",
        isVerified: false,
      } as Doc<"profiles">);

      await expect(
        requireVerified(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow(VERIFIED_REQUIRED_MESSAGE);
    });

    it("requireVerifiedSeller should throw if not seller or admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      queryMock.unique.mockResolvedValue({
        role: "buyer",
        isVerified: true,
      } as Doc<"profiles">);

      await expect(
        requireVerifiedSeller(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow("Seller account required");
    });

    it("requireVerifiedSeller should allow admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      const profile = { role: "admin", isVerified: true } as Doc<"profiles">;
      queryMock.unique.mockResolvedValue(profile);

      const result = await requireVerifiedSeller(
        mockCtx as unknown as QueryCtx
      );
      expect(result.profile).toEqual(profile);
    });

    it("getAuthenticatedProfile should return null if no user", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      expect(
        await getAuthenticatedProfile(mockCtx as unknown as QueryCtx)
      ).toBeNull();
    });

    it("getAuthenticatedProfile should return profile and userId", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(
        mockAuthUser as unknown as Awaited<
          ReturnType<typeof authComponent.getAuthUser>
        >
      );
      const profile = { role: "buyer", isVerified: true } as Doc<"profiles">;
      queryMock.unique.mockResolvedValue(profile);

      const result = await getAuthenticatedProfile(
        mockCtx as unknown as QueryCtx
      );
      expect(result?.profile).toEqual(profile);
      expect(result?.userId).toBe("user1");
    });

    it("getAuthWithProfile should return null if resolveUserId fails", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "s1" });
      // @ts-expect-error - testing invalid return
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _id: undefined as any,
        userId: null,
      });
      expect(
        await getAuthWithProfile(mockCtx as unknown as QueryCtx)
      ).toBeNull();
    });
  });

  describe("resolveUserId", () => {
    it("should return userId if present", () => {
      expect(
        resolveUserId({ _id: "i1" as Id<"profiles">, userId: "u1" } as AuthUser)
      ).toBe("u1");
    });
    it("should return _id if userId missing", () => {
      expect(resolveUserId({ _id: "i1" as Id<"profiles"> } as AuthUser)).toBe(
        "i1"
      );
    });
  });
});
