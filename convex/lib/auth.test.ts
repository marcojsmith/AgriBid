import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { 
  getAuthUser, 
  requireAuth, 
  getAuthenticatedUserId, 
  getCallerRole, 
  requireAdmin, 
  getAuthWithProfile,
  requireProfile,
  requireVerified,
  requireVerifiedSeller,
  resolveUserId,
  UnauthorizedError,
  VERIFIED_REQUIRED_MESSAGE
} from "./auth";
import { authComponent } from "../auth";

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

describe("Auth Utilities", () => {
  let mockCtx: any;

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
      },
    };
    (mockCtx as any).queryMock = queryMock;
  });


  describe("getAuthUser", () => {
    it("should return null if no identity", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      const user = await getAuthUser(mockCtx);
      expect(user).toBeNull();
    });

    it("should return null if identity has no subject", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ name: "Guest" });
      const user = await getAuthUser(mockCtx);
      expect(user).toBeNull();
    });

    it("should return user from authComponent if successful", async () => {
      const mockUser = { _id: "u1", email: "test@example.com" };
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser as any);
      
      const user = await getAuthUser(mockCtx);
      expect(user).toEqual(mockUser);
    });

    it("should fallback to manual lookup if authComponent fails with ArgumentValidationError", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(new Error("ArgumentValidationError: ..."));
      
      const mockUserRecord = { _id: "u1", userId: "user_1", email: "test@example.com" };
      mockCtx.db.get.mockResolvedValue(mockUserRecord);

      const user = await getAuthUser(mockCtx);
      expect(user).toEqual(expect.objectContaining({
        _id: "u1",
        userId: "user_1",
        email: "test@example.com"
      }));
    });
  });

  describe("requireAuth", () => {
    it("should return user if authenticated", async () => {
      const mockUser = { _id: "u1" };
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(mockUser as any);

      const user = await requireAuth(mockCtx);
      expect(user).toEqual(mockUser);
    });

    it("should throw if not authenticated", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      await expect(requireAuth(mockCtx)).rejects.toThrow("Not authenticated");
    });
  });

  describe("getCallerRole", () => {
    it("should return role from profile", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({ _id: "u1" } as any);
      
      mockCtx.queryMock.unique.mockResolvedValue({ userId: "u1", role: "seller" });

      const role = await getCallerRole(mockCtx);
      expect(role).toBe("seller");
    });

    it("should return null if user not found", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue(null);
      const role = await getCallerRole(mockCtx);
      expect(role).toBeNull();
    });
  });

  describe("requireAdmin", () => {
    it("should succeed if user is admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({ _id: "u1" } as any);
      mockCtx.queryMock.unique.mockResolvedValue({ userId: "u1", role: "admin" });

      const user = await requireAdmin(mockCtx);
      expect(user).toBeDefined();
    });

    it("should throw if user is not admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({ _id: "u1" } as any);
      mockCtx.queryMock.unique.mockResolvedValue({ userId: "u1", role: "buyer" });

      await expect(requireAdmin(mockCtx)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("requireVerified", () => {
    it("should succeed if user is verified", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({ _id: "u1" } as any);
      mockCtx.queryMock.unique.mockResolvedValue({ userId: "u1", isVerified: true });

      const result = await requireVerified(mockCtx);
      expect(result.profile.isVerified).toBe(true);
    });

    it("should throw if user is not verified", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({ _id: "u1" } as any);
      mockCtx.queryMock.unique.mockResolvedValue({ userId: "u1", isVerified: false });

      await expect(requireVerified(mockCtx)).rejects.toThrow(VERIFIED_REQUIRED_MESSAGE);
    });
  });

  describe("requireVerifiedSeller", () => {
    it("should succeed if verified seller", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({ _id: "u1" } as any);
      mockCtx.queryMock.unique.mockResolvedValue({ userId: "u1", isVerified: true, role: "seller" });

      const result = await requireVerifiedSeller(mockCtx);
      expect(result.profile.role).toBe("seller");
    });

    it("should succeed if verified admin", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({ _id: "u1" } as any);
      mockCtx.queryMock.unique.mockResolvedValue({ userId: "u1", isVerified: true, role: "admin" });

      const result = await requireVerifiedSeller(mockCtx);
      expect(result.profile.role).toBe("admin");
    });

    it("should throw if buyer", async () => {
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "u1" });
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({ _id: "u1" } as any);
      mockCtx.queryMock.unique.mockResolvedValue({ userId: "u1", isVerified: true, role: "buyer" });

      await expect(requireVerifiedSeller(mockCtx)).rejects.toThrow("Seller account required");
    });
  });
});
