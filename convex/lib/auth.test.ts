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
  tryRequireAdmin,
  UnauthorizedError,
  VERIFIED_REQUIRED_MESSAGE,
} from "./auth";
import type { AuthUser } from "./auth";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

describe("Auth Utilities Coverage", () => {
  const mockIdentity = {
    subject: "user_123",
    name: "User 1",
    email: "u1@test.com",
    pictureUrl: "https://cdn.agribid.test/avatar.png",
  };

  const mockAuthUser: AuthUser = {
    _id: "user_123",
    userId: "user_123",
    name: "User 1",
    email: "u1@test.com",
    image: "https://cdn.agribid.test/avatar.png",
  };

  interface MockCtx {
    auth: { getUserIdentity: ReturnType<typeof vi.fn> };
    db: { query: ReturnType<typeof vi.fn> };
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
        query: vi.fn(() => queryMock),
      },
    };
  });

  describe("getAuthUser", () => {
    it("should return null if there is no identity", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      expect(await getAuthUser(mockCtx as unknown as QueryCtx)).toBeNull();
    });

    it("should map Clerk identity claims onto an AuthUser", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);

      expect(await getAuthUser(mockCtx as unknown as QueryCtx)).toEqual(
        mockAuthUser
      );
    });

    it("should return null without logging when the identity lookup throws", async () => {
      mockCtx.auth.getUserIdentity.mockRejectedValue(new Error("Critical"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(await getAuthUser(mockCtx as unknown as QueryCtx)).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("Helper Functions", () => {
    it("requireAuth should throw if no user", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      await expect(requireAuth(mockCtx as unknown as QueryCtx)).rejects.toThrow(
        "Not authenticated"
      );
    });

    it("requireAuth should return the auth user when authenticated", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);

      expect(await requireAuth(mockCtx as unknown as QueryCtx)).toEqual(
        mockAuthUser
      );
    });

    it("getAuthenticatedUserId should return the resolved user ID", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);

      expect(await getAuthenticatedUserId(mockCtx as unknown as QueryCtx)).toBe(
        "user_123"
      );
    });

    it("getAuthenticatedUserId should throw if the user ID cannot be resolved", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({});

      await expect(
        getAuthenticatedUserId(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow("Unable to determine user ID");
    });

    it("getCallerRole should return the profile role", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);

      let capturedFilter:
        | ((q: { eq: (f: string, v: unknown) => unknown }) => unknown)
        | undefined;
      queryMock.withIndex.mockImplementation(
        (
          _index: string,
          filter: (q: { eq: (f: string, v: unknown) => unknown }) => unknown
        ) => {
          capturedFilter = filter;
          return queryMock;
        }
      );

      queryMock.unique.mockResolvedValue({ role: "buyer" } as Doc<"profiles">);

      expect(await getCallerRole(mockCtx as unknown as QueryCtx)).toBe("buyer");

      const q = { eq: vi.fn() };
      if (capturedFilter) {
        capturedFilter(q);
      }
      expect(q.eq).toHaveBeenCalledWith("userId", "user_123");
    });

    it("getCallerRole should return null if no profile or lookup error", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);

      queryMock.unique.mockResolvedValue(null);
      expect(await getCallerRole(mockCtx as unknown as QueryCtx)).toBeNull();

      queryMock.unique.mockRejectedValue(new Error("DB Error"));
      expect(await getCallerRole(mockCtx as unknown as QueryCtx)).toBeNull();
    });

    it("requireAdmin should throw if not admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);
      queryMock.unique.mockResolvedValue({ role: "buyer" } as Doc<"profiles">);

      await expect(
        requireAdmin(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow(UnauthorizedError);
    });

    it("requireAdmin should return user if admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);
      queryMock.unique.mockResolvedValue({ role: "admin" } as Doc<"profiles">);

      expect(await requireAdmin(mockCtx as unknown as QueryCtx)).toEqual(
        mockAuthUser
      );
    });

    it("requireProfile should throw if profile missing", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);
      queryMock.unique.mockResolvedValue(null);

      await expect(
        requireProfile(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow(ConvexError);
    });

    it("requireVerified should throw if not verified", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);
      queryMock.unique.mockResolvedValue({
        role: "buyer",
        isVerified: false,
      } as Doc<"profiles">);

      await expect(
        requireVerified(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow(VERIFIED_REQUIRED_MESSAGE);
    });

    it("requireVerifiedSeller should throw if not seller or admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);
      queryMock.unique.mockResolvedValue({
        role: "buyer",
        isVerified: true,
      } as Doc<"profiles">);

      await expect(
        requireVerifiedSeller(mockCtx as unknown as QueryCtx)
      ).rejects.toThrow("Seller account required");
    });

    it("requireVerifiedSeller should allow admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);
      const profile = { role: "admin", isVerified: true } as Doc<"profiles">;
      queryMock.unique.mockResolvedValue(profile);

      const result = await requireVerifiedSeller(
        mockCtx as unknown as QueryCtx
      );
      expect(result.profile).toEqual(profile);
      expect(result.userId).toBe("user_123");
    });

    it("getAuthenticatedProfile should return null if no user", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);

      expect(
        await getAuthenticatedProfile(mockCtx as unknown as QueryCtx)
      ).toBeNull();
    });

    it("getAuthenticatedProfile should return profile and userId", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);

      let capturedFilter:
        | ((q: { eq: (f: string, v: unknown) => unknown }) => unknown)
        | undefined;
      queryMock.withIndex.mockImplementation(
        (
          _index: string,
          filter: (q: { eq: (f: string, v: unknown) => unknown }) => unknown
        ) => {
          capturedFilter = filter;
          return queryMock;
        }
      );

      const profile = { role: "buyer", isVerified: true } as Doc<"profiles">;
      queryMock.unique.mockResolvedValue(profile);

      const result = await getAuthenticatedProfile(
        mockCtx as unknown as QueryCtx
      );
      expect(result?.profile).toEqual(profile);
      expect(result?.userId).toBe("user_123");

      const q = { eq: vi.fn() };
      if (capturedFilter) {
        capturedFilter(q);
      }
      expect(q.eq).toHaveBeenCalledWith("userId", "user_123");
    });

    it("getAuthWithProfile should return null if the user ID cannot be resolved", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({});

      expect(
        await getAuthWithProfile(mockCtx as unknown as QueryCtx)
      ).toBeNull();
    });
  });

  describe("resolveUserId", () => {
    it("should return userId if present", () => {
      expect(resolveUserId({ _id: "i1", userId: "u1" })).toBe("u1");
    });

    it("should return _id if userId missing", () => {
      expect(resolveUserId({ _id: "i1" })).toBe("i1");
    });

    it("should fall back to _id when userId is null", () => {
      expect(resolveUserId({ _id: "i1", userId: null })).toBe("i1");
    });
  });

  describe("tryRequireAdmin", () => {
    it("should return authorized: true when admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);
      queryMock.unique.mockResolvedValue({ role: "admin" } as Doc<"profiles">);

      const result = await tryRequireAdmin(mockCtx as unknown as QueryCtx);
      expect(result).toEqual({ authorized: true, user: mockAuthUser });
    });

    it("should return authorized: false with error message when UnauthorizedError", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(mockIdentity);
      queryMock.unique.mockResolvedValue({ role: "buyer" } as Doc<"profiles">);

      const result = await tryRequireAdmin(mockCtx as unknown as QueryCtx);
      expect(result).toEqual({
        authorized: false,
        error: "Not authorized: Admin privileges required",
      });
    });

    it("should return authorized: false when not authenticated", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);

      const result = await tryRequireAdmin(mockCtx as unknown as QueryCtx);
      expect(result).toEqual({
        authorized: false,
        error: "Not authenticated",
      });
    });
  });
});
