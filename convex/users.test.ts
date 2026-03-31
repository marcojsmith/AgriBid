import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  syncUserHandler,
  getMyProfileHandler,
  listAllProfilesHandler,
  getProfileForKYCHandler,
  verifyUserHandler,
  promoteToAdminHandler,
  submitKYCHandler,
  getMyKYCDetailsHandler,
  deleteMyKYCDocumentHandler,
  findUserById,
  updateMyProfileHandler,
} from "./users";
import * as auth from "./lib/auth";
import * as adminUtils from "./admin_utils";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { AuthUser } from "./auth";

vi.mock("./lib/auth", () => ({
  getAuthUser: vi.fn(),
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
  requireAdmin: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));

const mockAdminUser: AuthUser = {
  _id: "u1",
  userId: "admin1",
  name: "Admin User",
  email: "admin@test.com",
};

vi.mock("./admin_utils", () => ({
  logAudit: vi.fn(),
  encryptPII: vi.fn((val) => Promise.resolve(`enc_${val}`)),
  decryptPII: vi.fn((val) => Promise.resolve(val?.replace("enc_", "") ?? "")),
  updateCounter: vi.fn(),
  countQuery: vi.fn().mockResolvedValue(0),
}));

interface MockQuery {
  withIndex: (index: string, cb?: (q: unknown) => unknown) => MockQuery;
  filter: (cb: (q: unknown) => unknown) => MockQuery;
  unique: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  paginate: ReturnType<typeof vi.fn>;
}

interface MockCtx {
  db: {
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  storage: {
    getUrl: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  auth: {
    getUserIdentity: ReturnType<typeof vi.fn>;
  };
  runQuery: ReturnType<typeof vi.fn>;
}

describe("Users Coverage", () => {
  let mockCtx: MockCtx;
  let queryMock: MockQuery;

  beforeEach(() => {
    vi.resetAllMocks();

    const q: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb({ eq: vi.fn().mockReturnThis() });
        return q;
      }),
      filter: vi.fn((cb) => {
        if (cb)
          cb({
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            field: vi.fn().mockReturnThis(),
          });
        return q;
      }),
      unique: vi.fn().mockResolvedValue(null),
      collect: vi.fn().mockResolvedValue([]),
      order: vi.fn().mockReturnThis(),
      paginate: vi.fn().mockResolvedValue({
        page: [],
        isDone: true,
        continueCursor: "",
      }),
    };
    queryMock = q;

    mockCtx = {
      db: {
        get: vi.fn().mockResolvedValue(null),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(() => queryMock),
      },
      storage: {
        getUrl: vi.fn().mockResolvedValue("http://storage/url"),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user123" }),
      },
      runQuery: vi.fn().mockResolvedValue(null),
    };
  });

  describe("findUserById", () => {
    it("should return null if no id is provided", async () => {
      const result = await findUserById(mockCtx as unknown as QueryCtx, "");
      expect(result).toBeNull();
    });

    it("should find user by userId index", async () => {
      mockCtx.runQuery.mockResolvedValueOnce({ name: "Test User" });
      const result = await findUserById(
        mockCtx as unknown as QueryCtx,
        "user123"
      );
      expect(result).toEqual({ name: "Test User" });
      expect(mockCtx.runQuery).toHaveBeenCalled();
    });

    it("should find user by _id if userId fails", async () => {
      mockCtx.runQuery
        .mockResolvedValueOnce(null) // userId find fails
        .mockResolvedValueOnce({ name: "Internal User" }); // _id find succeeds

      const result = await findUserById(
        mockCtx as unknown as QueryCtx,
        "id123"
      );
      expect(result).toEqual({ name: "Internal User" });
      expect(mockCtx.runQuery).toHaveBeenCalledTimes(2);
    });

    it("should return null if all searches fail", async () => {
      mockCtx.runQuery.mockResolvedValue(null);
      const result = await findUserById(
        mockCtx as unknown as QueryCtx,
        "id123"
      );
      expect(result).toBeNull();
    });

    it("should return null if _id search throws (invalid format)", async () => {
      mockCtx.runQuery
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error("Invalid ID"));

      const result = await findUserById(
        mockCtx as unknown as QueryCtx,
        "not-a-convex-id"
      );
      expect(result).toBeNull();
    });
  });

  describe("syncUserHandler", () => {
    it("should create a profile if it doesn't exist", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");

      const result = await syncUserHandler(mockCtx as unknown as MutationCtx);

      expect(result).toEqual({ success: true });
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "profiles",
        expect.objectContaining({
          userId: "user123",
          role: "buyer",
          isVerified: false,
        })
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx as unknown as MutationCtx,
        "profiles",
        "total",
        1
      );
    });

    it("should not create a profile if it already exists", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({ _id: "p1" });

      const result = await syncUserHandler(mockCtx as unknown as MutationCtx);

      expect(result).toEqual({ success: true });
      expect(mockCtx.db.insert).not.toHaveBeenCalled();
    });

    it("should return null if auth fails", async () => {
      vi.mocked(auth.requireAuth).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const result = await syncUserHandler(mockCtx as unknown as MutationCtx);
      expect(result).toBeNull();
    });

    it("should return null and log error for other errors", async () => {
      vi.mocked(auth.requireAuth).mockRejectedValue(new Error("DB Error"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await syncUserHandler(mockCtx as unknown as MutationCtx);
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should return null if resolveUserId returns null", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      const result = await syncUserHandler(mockCtx as unknown as MutationCtx);
      expect(result).toBeNull();
    });
  });

  describe("getMyProfileHandler", () => {
    it("should return user info and profile", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user123",
        name: "Test",
        email: "test@example.com",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      const mockProfile = { _id: "p1", userId: "user123", role: "buyer" };
      queryMock.unique.mockResolvedValue(mockProfile);

      const result = await getMyProfileHandler(mockCtx as unknown as QueryCtx);

      expect(result).toEqual({
        _id: "u1",
        userId: "user123",
        name: "Test",
        email: "test@example.com",
        profile: mockProfile,
      });
    });

    it("should return null if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getMyProfileHandler(mockCtx as unknown as QueryCtx);
      expect(result).toBeNull();
    });

    it("should return null if resolveUserId fails", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      const result = await getMyProfileHandler(mockCtx as unknown as QueryCtx);
      expect(result).toBeNull();
    });

    it("should handle profile not found", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user123",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue(null);

      const result = await getMyProfileHandler(mockCtx as unknown as QueryCtx);
      expect(result?.profile).toBeNull();
    });

    it("should handle missing optional auth fields", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue(null);

      const result = await getMyProfileHandler(mockCtx as unknown as QueryCtx);
      expect(result).toEqual({
        _id: "u1",
        userId: undefined,
        name: undefined,
        email: undefined,
        profile: null,
      });
    });

    it("should catch and log errors", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(new Error("Fail"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await getMyProfileHandler(mockCtx as unknown as QueryCtx);
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should ignore Unauthenticated errors in log", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await getMyProfileHandler(mockCtx as unknown as QueryCtx);
      expect(result).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("listAllProfilesHandler", () => {
    it("should require admin and return profiles with presence", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      const mockProfiles = [
        {
          _id: "p1",
          userId: "user1",
          role: "buyer",
          isVerified: false,
          kycStatus: "pending",
          createdAt: 100,
        },
        {
          _id: "p2",
          userId: "user2",
          role: "seller",
          isVerified: true,
          createdAt: 200,
        },
      ];
      queryMock.paginate.mockResolvedValue({
        page: mockProfiles,
        isDone: true,
        continueCursor: "next",
      });

      // Simplified mock for the presence/counter logic
      queryMock.unique
        .mockResolvedValueOnce({ total: 2 }) // counter
        .mockResolvedValueOnce({ userId: "user1", updatedAt: Date.now() }) // presence user1
        .mockResolvedValueOnce(null); // presence user2

      mockCtx.runQuery.mockResolvedValue({ name: "User Name" });

      const result = await listAllProfilesHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );

      expect(auth.requireAdmin).toHaveBeenCalledWith(
        mockCtx as unknown as MutationCtx
      );
      expect(result.page).toHaveLength(2);
      expect(result.page[0].userId).toBe("user1");
      expect(result.page[0].isOnline).toBe(true);
      expect(result.page[1].isOnline).toBe(false);
      expect(result.totalCount).toBe(2);
    });

    it("should fallback to countQuery if counter is missing", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      queryMock.unique.mockResolvedValue(null);
      vi.mocked(adminUtils.countQuery).mockResolvedValue(5);

      const result = await listAllProfilesHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );
      expect(result.totalCount).toBe(5);
    });
  });

  describe("getProfileForKYCHandler", () => {
    it("should return profile with decrypted PII and storage URLs", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      const mockProfile = {
        _id: "p1",
        userId: "user123",
        firstName: "enc_John",
        lastName: "enc_Doe",
        idNumber: "enc_123",
        phoneNumber: "enc_555",
        kycEmail: "enc_john@example.com",
        kycDocuments: ["s1", "s2"],
      };
      queryMock.unique.mockResolvedValue(mockProfile);
      mockCtx.runQuery.mockResolvedValue({
        name: "John Doe",
        email: "john@example.com",
      });
      mockCtx.storage.getUrl.mockResolvedValue("http://storage/s1");

      const result = await getProfileForKYCHandler(
        mockCtx as unknown as MutationCtx,
        { userId: "user123" }
      );

      expect(result).toMatchObject({
        firstName: "John",
        lastName: "Doe",
        idNumber: "123",
        phoneNumber: "555",
        kycEmail: "john@example.com",
        kycDocumentUrls: ["http://storage/s1", "http://storage/s1"],
      });
      expect(adminUtils.logAudit).toHaveBeenCalled();
    });

    it("should handle profile with no documents", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      const mockProfile = {
        _id: "p1",
        userId: "user123",
        kycDocuments: undefined,
      };
      queryMock.unique.mockResolvedValue(mockProfile);
      const result = await getProfileForKYCHandler(
        mockCtx as unknown as MutationCtx,
        { userId: "user123" }
      );
      expect(result?.kycDocumentUrls).toEqual([]);
    });

    it("should return null if profile not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      queryMock.unique.mockResolvedValue(null);
      const result = await getProfileForKYCHandler(
        mockCtx as unknown as MutationCtx,
        { userId: "user123" }
      );
      expect(result).toBeNull();
    });
  });

  describe("verifyUserHandler", () => {
    it("should verify a user and update counter", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        userId: "admin1",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      queryMock.unique.mockResolvedValue({
        _id: "p1",
        userId: "user123",
        isVerified: false,
        kycStatus: "verified",
      });

      const result = await verifyUserHandler(
        mockCtx as unknown as MutationCtx,
        { userId: "user123" }
      );

      expect(result).toEqual({ success: true });
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ isVerified: true })
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx as unknown as MutationCtx,
        "profiles",
        "verified",
        1
      );
      expect(adminUtils.logAudit).toHaveBeenCalled();
    });

    it("should handle admin with no userId (fallback to _id)", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "admin_id",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      queryMock.unique.mockResolvedValue({
        _id: "p1",
        kycStatus: "pending",
      });
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await verifyUserHandler(mockCtx as unknown as MutationCtx, {
        userId: "user123",
      });

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Admin admin_id")
      );
      spy.mockRestore();
    });

    it("should warn if manual verification happens without KYC", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        userId: "admin1",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      queryMock.unique.mockResolvedValue({
        _id: "p1",
        userId: "user123",
        isVerified: false,
        kycStatus: "pending",
      });
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await verifyUserHandler(mockCtx as unknown as MutationCtx, {
        userId: "user123",
      });

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should throw if profile not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      queryMock.unique.mockResolvedValue(null);
      await expect(
        verifyUserHandler(mockCtx as unknown as MutationCtx, {
          userId: "user123",
        })
      ).rejects.toThrow("Profile not found");
    });

    it("should throw if not authenticated", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      queryMock.unique.mockResolvedValue({ _id: "p1" });
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      await expect(
        verifyUserHandler(mockCtx as unknown as MutationCtx, {
          userId: "user123",
        })
      ).rejects.toThrow("Not authenticated");
    });

    it("should not update counter if already verified", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        userId: "admin1",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      queryMock.unique.mockResolvedValue({
        _id: "p1",
        isVerified: true,
        kycStatus: "verified",
      });

      await verifyUserHandler(mockCtx as unknown as MutationCtx, {
        userId: "user123",
      });

      expect(mockCtx.db.patch).not.toHaveBeenCalled();
      expect(adminUtils.updateCounter).not.toHaveBeenCalled();
    });
  });

  describe("promoteToAdminHandler", () => {
    it("should promote user to admin", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "admin1" });
      queryMock.unique.mockResolvedValue({
        _id: "p1",
        userId: "user123",
        role: "buyer",
      });

      const result = await promoteToAdminHandler(
        mockCtx as unknown as MutationCtx,
        { userId: "user123" }
      );

      expect(result).toEqual({ success: true });
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ role: "admin" })
      );
      expect(adminUtils.logAudit).toHaveBeenCalled();
    });

    it("should throw if trying to promote self", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "user123" });
      await expect(
        promoteToAdminHandler(mockCtx as unknown as MutationCtx, {
          userId: "user123",
        })
      ).rejects.toThrow(ConvexError);
    });

    it("should throw if profile not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "admin1" });
      queryMock.unique.mockResolvedValue(null);
      await expect(
        promoteToAdminHandler(mockCtx as unknown as MutationCtx, {
          userId: "user123",
        })
      ).rejects.toThrow("Profile not found");
    });

    it("should be no-op if already admin", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      mockCtx.auth.getUserIdentity.mockResolvedValue({ subject: "admin1" });
      queryMock.unique.mockResolvedValue({ _id: "p1", role: "admin" });
      const result = await promoteToAdminHandler(
        mockCtx as unknown as MutationCtx,
        { userId: "user123" }
      );
      expect(result).toEqual({ success: true });
      expect(mockCtx.db.patch).not.toHaveBeenCalled();
    });
  });

  describe("submitKYCHandler", () => {
    it("should submit KYC and update counter", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({ _id: "p1", kycStatus: "rejected" });
      mockCtx.storage.getUrl.mockResolvedValue("http://url");

      const args = {
        documents: ["s1" as Id<"_storage">],
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "555",
        idNumber: "123",
        email: "john@example.com",
      };

      const result = await submitKYCHandler(
        mockCtx as unknown as MutationCtx,
        args
      );

      expect(result).toEqual({ success: true });
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({
          kycStatus: "pending",
          firstName: "enc_John",
        })
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx as unknown as MutationCtx,
        "profiles",
        "pending",
        1
      );
    });

    it("should throw if storage ID is invalid", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      mockCtx.storage.getUrl.mockResolvedValue(null);
      await expect(
        submitKYCHandler(
          mockCtx as unknown as MutationCtx,
          { documents: ["s1" as Id<"_storage">] } as unknown as Parameters<
            typeof submitKYCHandler
          >[1]
        )
      ).rejects.toThrow("Invalid storage ID");
    });

    it("should throw if resolveUserId fails", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      await expect(
        submitKYCHandler(
          mockCtx as unknown as MutationCtx,
          { documents: [] } as unknown as Parameters<typeof submitKYCHandler>[1]
        )
      ).rejects.toThrow("Unable to determine user ID");
    });

    it("should throw if profile not found", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue(null);
      await expect(
        submitKYCHandler(
          mockCtx as unknown as MutationCtx,
          { documents: [] } as unknown as Parameters<typeof submitKYCHandler>[1]
        )
      ).rejects.toThrow("Profile not found");
    });

    it("should not increment counter if already pending", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({ _id: "p1", kycStatus: "pending" });

      await submitKYCHandler(
        mockCtx as unknown as MutationCtx,
        { documents: [] } as unknown as Parameters<typeof submitKYCHandler>[1]
      );

      expect(adminUtils.updateCounter).not.toHaveBeenCalled();
    });
  });

  describe("getMyKYCDetailsHandler", () => {
    it("should return decrypted KYC details", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user123",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({
        _id: "p1",
        firstName: "enc_John",
        kycDocuments: ["s1"],
      });

      const result = await getMyKYCDetailsHandler(
        mockCtx as unknown as QueryCtx
      );

      expect(result).toMatchObject({
        firstName: "John",
        kycDocumentIds: ["s1"],
      });
    });

    it("should handle profile with no documents in getMyKYCDetails", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user123",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({
        _id: "p1",
        kycDocuments: undefined,
      });

      const result = await getMyKYCDetailsHandler(
        mockCtx as unknown as QueryCtx
      );

      expect(result?.kycDocumentIds).toBeUndefined();
      expect(result?.kycDocumentUrls).toEqual([]);
    });

    it("should return null if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getMyKYCDetailsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toBeNull();
    });

    it("should ignore Unauthenticated errors in KYC details log", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await getMyKYCDetailsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("deleteMyKYCDocumentHandler", () => {
    it("should delete a KYC document", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({
        _id: "p1",
        kycStatus: "verified",
        kycDocuments: ["s1", "s2"],
      });

      const result = await deleteMyKYCDocumentHandler(
        mockCtx as unknown as MutationCtx,
        { storageId: "s1" as Id<"_storage"> }
      );

      expect(result).toEqual({ success: true });
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ kycDocuments: ["s2"] })
      );
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("s1");
    });

    it("should handle profile with no documents during deletion", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({
        _id: "p1",
        kycDocuments: undefined,
      });

      await expect(
        deleteMyKYCDocumentHandler(mockCtx as unknown as MutationCtx, {
          storageId: "s1" as Id<"_storage">,
        })
      ).rejects.toThrow("Document not found in your profile");
    });

    it("should throw if resolveUserId fails", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      await expect(
        deleteMyKYCDocumentHandler(mockCtx as unknown as MutationCtx, {
          storageId: "s1" as Id<"_storage">,
        })
      ).rejects.toThrow("Unable to determine user ID");
    });

    it("should throw if profile not found", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue(null);
      await expect(
        deleteMyKYCDocumentHandler(mockCtx as unknown as MutationCtx, {
          storageId: "s1" as Id<"_storage">,
        })
      ).rejects.toThrow(ConvexError);
    });

    it("should throw if KYC is pending", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({ _id: "p1", kycStatus: "pending" });
      await expect(
        deleteMyKYCDocumentHandler(mockCtx as unknown as MutationCtx, {
          storageId: "s1" as Id<"_storage">,
        })
      ).rejects.toThrow("Cannot delete document while KYC is pending");
    });

    it("should throw if document not in profile", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({ _id: "p1", kycDocuments: ["s2"] });
      await expect(
        deleteMyKYCDocumentHandler(mockCtx as unknown as MutationCtx, {
          storageId: "s1" as Id<"_storage">,
        })
      ).rejects.toThrow("Document not found in your profile");
    });

    it("should handle storage deletion failure gracefully", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAuth>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("user123");
      queryMock.unique.mockResolvedValue({ _id: "p1", kycDocuments: ["s1"] });
      mockCtx.storage.delete.mockRejectedValue(
        new Error("Storage Delete Fail")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await deleteMyKYCDocumentHandler(
        mockCtx as unknown as MutationCtx,
        { storageId: "s1" as Id<"_storage"> }
      );

      expect(result).toEqual({ success: true });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("updateMyProfileHandler", () => {
    it("patches profile with provided fields", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      queryMock.unique.mockResolvedValue({ _id: "p1" as Id<"profiles"> });

      const result = await updateMyProfileHandler(
        mockCtx as unknown as MutationCtx,
        { bio: "New bio", location: "Cape Town", companyName: "Farm Co" }
      );

      expect(result).toBeNull();
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({
          bio: "New bio",
          location: "Cape Town",
          companyName: "Farm Co",
        })
      );
    });

    it("throws ConvexError when profile not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      queryMock.unique.mockResolvedValue(null);

      await expect(
        updateMyProfileHandler(mockCtx as unknown as MutationCtx, {
          bio: "Bio",
        })
      ).rejects.toThrow(ConvexError);
    });

    it("patches with only provided fields (partial update)", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      queryMock.unique.mockResolvedValue({ _id: "p1" as Id<"profiles"> });

      await updateMyProfileHandler(mockCtx as unknown as MutationCtx, {
        location: "Pretoria",
      });

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ location: "Pretoria" })
      );
      const patchArgs = mockCtx.db.patch.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      expect(patchArgs.bio).toBeUndefined();
    });
  });
});
