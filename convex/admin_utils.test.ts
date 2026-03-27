import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getCounter,
  countQuery,
  sumQuery,
  countUsers,
  logAudit,
  updateCounter,
  encryptPII,
  decryptPII,
  resolveUserId,
} from "./admin_utils";
import * as auth from "./lib/auth";
import * as encryption from "./lib/encryption";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { AuthUser } from "./auth";

vi.mock("./lib/auth", () => ({
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
}));

vi.mock("./lib/encryption", () => ({
  encryptPII: vi.fn(),
  decryptPII: vi.fn(),
}));

interface MockQuery {
  withIndex: ReturnType<typeof vi.fn>;
  unique: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
  count?: ReturnType<typeof vi.fn>;
}

interface MockCtx {
  db: {
    query: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
}

describe("Admin Utils", () => {
  let mockCtx: MockCtx;
  let queryMock: MockQuery;

  beforeEach(() => {
    vi.resetAllMocks();
    queryMock = {
      withIndex: vi.fn((_index, cb) => {
        if (cb) {
          cb({
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
          });
        }
        return queryMock;
      }),
      unique: vi.fn().mockResolvedValue(null),
      collect: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
    mockCtx = {
      db: {
        query: vi.fn(() => queryMock),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  describe("Re-exports", () => {
    it("should export encryption and auth functions", () => {
      expect(encryptPII).toBeDefined();
      expect(decryptPII).toBeDefined();
      expect(resolveUserId).toBeDefined();

      // Call them to ensure they are the ones from the libs
      encryptPII("test");
      expect(encryption.encryptPII).toHaveBeenCalledWith("test");

      decryptPII("test");
      expect(encryption.decryptPII).toHaveBeenCalledWith("test");

      resolveUserId({} as unknown as AuthUser);
      expect(auth.resolveUserId).toHaveBeenCalled();
    });
  });

  describe("getCounter", () => {
    it("should fetch counter by name", async () => {
      let capturedFilter:
        | ((q: { eq: (f: string, v: unknown) => unknown }) => unknown)
        | undefined;
      queryMock.withIndex.mockImplementation((_index, filter) => {
        capturedFilter = filter;
        return queryMock;
      });

      await getCounter(mockCtx as unknown as QueryCtx, "test");

      const q = { eq: vi.fn() };
      if (capturedFilter) capturedFilter(q);
      expect(q.eq).toHaveBeenCalledWith("name", "test");
      expect(queryMock.unique).toHaveBeenCalled();
    });
  });

  describe("countQuery", () => {
    it("should use count() if available", async () => {
      if (queryMock.count) queryMock.count.mockResolvedValue(10);
      const result = await countQuery(
        queryMock as unknown as Parameters<typeof countQuery>[0]
      );
      expect(result).toBe(10);
    });

    it("should fallback to collect()", async () => {
      const q = { collect: vi.fn().mockResolvedValue([1, 2, 3]) };
      const result = await countQuery(
        q as unknown as Parameters<typeof countQuery>[0]
      );
      expect(result).toBe(3);
    });
  });

  describe("sumQuery", () => {
    it("should sum numeric fields", async () => {
      queryMock.collect.mockResolvedValue([
        { val: 10 },
        { val: 20 },
        { val: "not-a-number" },
        { other: 5 },
      ]);
      const result = await sumQuery(
        queryMock as unknown as Parameters<typeof sumQuery>[0],
        "val"
      );
      expect(result).toEqual({ sum: 30, count: 2 });
    });

    it("should handle empty results", async () => {
      queryMock.collect.mockResolvedValue([]);
      const result = await sumQuery(
        queryMock as unknown as Parameters<typeof sumQuery>[0],
        "val"
      );
      expect(result).toEqual({ sum: 0, count: 0 });
    });
  });

  describe("countUsers", () => {
    it("should use counter for total if requested", async () => {
      queryMock.unique.mockResolvedValue({ total: 100 });
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        useCounter: true,
      });
      expect(result).toBe(100);
    });

    it("should use counter for verified if requested", async () => {
      queryMock.unique.mockResolvedValue({ total: 100, verified: 80 });
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        useCounter: true,
        isVerified: true,
      });
      expect(result).toBe(80);
    });

    it("should return unverified from counter", async () => {
      queryMock.unique.mockResolvedValue({ total: 100, verified: 80 });
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        useCounter: true,
        isVerified: false,
      });
      expect(result).toBe(20);
    });

    it("should handle counter verified being undefined", async () => {
      queryMock.unique.mockResolvedValue({ total: 100 });
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        useCounter: true,
        isVerified: true,
      });
      expect(result).toBe(0);
    });

    it("should use index for single filters without counter", async () => {
      let capturedFilter:
        | ((q: { eq: (f: string, v: unknown) => unknown }) => unknown)
        | undefined;
      queryMock.withIndex.mockImplementation((_index, filter) => {
        capturedFilter = filter;
        return queryMock;
      });
      queryMock.count?.mockResolvedValue(5);

      await countUsers(mockCtx as unknown as QueryCtx, { role: "admin" });

      const q = { eq: vi.fn() };
      if (capturedFilter) capturedFilter(q);
      expect(q.eq).toHaveBeenCalledWith("role", "admin");
    });

    it("should handle kycStatus filter", async () => {
      queryMock.count?.mockResolvedValue(3);

      await countUsers(mockCtx as unknown as QueryCtx, {
        kycStatus: "pending",
      });

      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_kycStatus",
        expect.any(Function)
      );
    });

    it("should use counter for pending KYC if requested", async () => {
      queryMock.unique.mockResolvedValue({ total: 100, pending: 15 });
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        useCounter: true,
        kycStatus: "pending",
      });
      expect(result).toBe(15);
    });

    it("should handle isVerified filter", async () => {
      queryMock.count?.mockResolvedValue(3);

      await countUsers(mockCtx as unknown as QueryCtx, {
        isVerified: true,
      });

      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_isVerified",
        expect.any(Function)
      );
    });

    it("should handle complex multiple filters with kycStatus and isVerified (no role)", async () => {
      queryMock.collect.mockResolvedValue([
        { role: "buyer", isVerified: true, kycStatus: "verified" },
        { role: "buyer", isVerified: false, kycStatus: "pending" },
      ]);

      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        kycStatus: "pending",
        isVerified: false,
      });

      expect(result).toBe(1);
    });

    it("should handle filter mismatches in complex block", async () => {
      queryMock.collect.mockResolvedValue([
        { role: "buyer", isVerified: true, kycStatus: "verified" },
      ]);

      // All mismatches
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        role: "admin",
        kycStatus: "pending",
        isVerified: false,
      });

      expect(result).toBe(0);
    });

    it("should handle complex multiple filters via in-memory filtering", async () => {
      let capturedFilter:
        | ((q: { eq: (f: string, v: unknown) => unknown }) => unknown)
        | undefined;
      queryMock.withIndex.mockImplementation((_index, filter) => {
        capturedFilter = filter;
        return queryMock;
      });
      queryMock.collect.mockResolvedValue([
        { role: "buyer", isVerified: true, kycStatus: "verified" },
        { role: "seller", isVerified: true, kycStatus: "verified" },
        { role: "buyer", isVerified: false, kycStatus: "pending" },
      ]);

      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        role: "buyer",
        isVerified: true,
      });

      const q = { eq: vi.fn() };
      if (capturedFilter) capturedFilter(q);
      expect(q.eq).toHaveBeenCalledWith("role", "buyer");
      expect(result).toBe(1);
    });

    it("should fallback to full scan if no filters and no counter", async () => {
      queryMock.collect.mockResolvedValue([1, 2, 3]);
      const result = await countUsers(mockCtx as unknown as QueryCtx, {});
      expect(result).toBe(3);
      expect(mockCtx.db.query).toHaveBeenCalledWith("profiles");
    });

    it("should handle useCounter true when counter is missing", async () => {
      queryMock.unique.mockResolvedValue(null);
      queryMock.collect.mockResolvedValue([1, 2]);
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        useCounter: true,
      });
      expect(result).toBe(2);
    });

    it("should use counter.verified when isVerified=true and counter exists", async () => {
      queryMock.unique.mockResolvedValue({ verified: 10, total: 100 });
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        isVerified: true,
        useCounter: true,
      });
      expect(result).toBe(10);
    });

    it("should calculate unverified from counter when isVerified=false and counter exists", async () => {
      queryMock.unique.mockResolvedValue({ verified: 10, total: 100 });
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        isVerified: false,
        useCounter: true,
      });
      expect(result).toBe(90);
    });

    it("should use counter.pending when kycStatus=pending and counter exists", async () => {
      queryMock.unique.mockResolvedValue({ pending: 5 });
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        kycStatus: "pending",
        useCounter: true,
      });
      expect(result).toBe(5);
    });

    it("should use kycStatus index for complex filters if role is missing", async () => {
      let capturedFilter:
        | ((q: { eq: (f: string, v: unknown) => unknown }) => unknown)
        | undefined;
      queryMock.withIndex.mockImplementation((_index, filter) => {
        capturedFilter = filter;
        return queryMock;
      });
      queryMock.collect.mockResolvedValue([
        { kycStatus: "pending", isVerified: false },
        { kycStatus: "pending", isVerified: true },
      ]);

      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        kycStatus: "pending",
        isVerified: true,
      });

      const q = { eq: vi.fn() };
      if (capturedFilter) capturedFilter(q);
      expect(q.eq).toHaveBeenCalledWith("kycStatus", "pending");
      expect(result).toBe(1);
    });

    it("should use role index for complex filters if role is present", async () => {
      let capturedFilter:
        | ((q: { eq: (f: string, v: unknown) => unknown }) => unknown)
        | undefined;
      queryMock.withIndex.mockImplementation((_index, filter) => {
        capturedFilter = filter;
        return queryMock;
      });
      queryMock.collect.mockResolvedValue([
        { role: "admin", isVerified: true },
        { role: "admin", isVerified: false },
      ]);
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        role: "admin",
        isVerified: true,
      });
      const q = { eq: vi.fn() };
      if (capturedFilter) capturedFilter(q);
      expect(q.eq).toHaveBeenCalledWith("role", "admin");
      expect(result).toBe(1);
    });

    it("should cover all filter branches in complex block", async () => {
      queryMock.collect.mockResolvedValue([
        { role: "buyer", isVerified: true, kycStatus: "verified" },
        { role: "seller", isVerified: true, kycStatus: "verified" },
        { role: "buyer", isVerified: false, kycStatus: "verified" },
        { role: "buyer", isVerified: true, kycStatus: "pending" },
      ]);

      // Provide only one optimized index filter (role), but have mismatches in others
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        role: "buyer",
        isVerified: true,
        kycStatus: "verified",
      });

      expect(result).toBe(1); // Only the first one matches all 3
    });

    it("should hit isVerified branch in complex block by providing only isVerified and skipping optimized", async () => {
      queryMock.withIndex.mockImplementation(() => {
        return queryMock;
      });
      // This test is just to ensure hasFilters logic is fully exercised
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        isVerified: true,
        useCounter: false,
      });
      expect(result).toBe(0);
    });
  });

  describe("logAudit", () => {
    it("should use authUser ID", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      await logAudit(mockCtx as unknown as MutationCtx, { action: "test" });
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auditLogs",
        expect.objectContaining({
          adminId: "user1",
        })
      );
    });

    it("should use authUser._id when userId is undefined", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "user_id_123",
      } as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>);
      await logAudit(mockCtx as unknown as MutationCtx, { action: "test" });
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auditLogs",
        expect.objectContaining({
          adminId: "user_id_123",
        })
      );
    });

    it("should handle error in logAudit counter update", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      // Make updateCounter fail by making getCounter (which it calls) fail
      queryMock.unique.mockRejectedValue(new Error("Database error"));
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await logAudit(mockCtx as unknown as MutationCtx, {
        action: "test",
        system: true,
      });

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update auditLogs counter"),
        expect.any(Error)
      );
      spy.mockRestore();
    });

    it("should use SYSTEM for system actions", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      await logAudit(mockCtx as unknown as MutationCtx, {
        action: "test",
        system: true,
      });
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auditLogs",
        expect.objectContaining({
          adminId: "SYSTEM",
        })
      );
    });

    it("should use UNAUTHENTICATED otherwise", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      await logAudit(mockCtx as unknown as MutationCtx, { action: "test" });
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auditLogs",
        expect.objectContaining({
          adminId: "UNAUTHENTICATED",
        })
      );
    });
  });

  describe("updateCounter", () => {
    it("should use absolute value if requested", async () => {
      queryMock.unique.mockResolvedValue({ _id: "c1", total: 10 });
      await updateCounter(
        mockCtx as unknown as MutationCtx,
        "test",
        "total",
        50,
        true
      );
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          total: 50,
        })
      );
    });

    it("should handle absolute value even if counter doesn't exist", async () => {
      queryMock.unique.mockResolvedValue(null);
      await updateCounter(
        mockCtx as unknown as MutationCtx,
        "test",
        "total",
        50,
        true
      );
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "counters",
        expect.objectContaining({
          total: 50,
        })
      );
    });

    it("should clamp to 0 and warn on underflow", async () => {
      queryMock.unique.mockResolvedValue({ _id: "c1", total: 10 });
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await updateCounter(
        mockCtx as unknown as MutationCtx,
        "test",
        "total",
        -20
      );
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({
          total: 0,
        })
      );
      expect(spy).toHaveBeenCalled();

      // Test absolute underflow to hit the other branch in the warning message
      await updateCounter(
        mockCtx as unknown as MutationCtx,
        "test",
        "total",
        -5,
        true
      );
      expect(spy).toHaveBeenCalledTimes(2);

      spy.mockRestore();
    });

    it("should initialize counter if not existing", async () => {
      queryMock.unique.mockResolvedValue(null);
      await updateCounter(
        mockCtx as unknown as MutationCtx,
        "test",
        "active",
        5
      );
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "counters",
        expect.objectContaining({
          name: "test",
          active: 5,
          total: 0,
        })
      );
    });
  });

  describe("updateCounter exhaustive", () => {
    const fields = [
      "total",
      "active",
      "pending",
      "verified",
      "open",
      "resolved",
      "draft",
      "salesVolume",
      "soldCount",
    ];

    fields.forEach((field) => {
      it(`should create new counter with ${field} field`, async () => {
        queryMock.unique.mockResolvedValue(null);

        await updateCounter(
          mockCtx as unknown as MutationCtx,
          "test_table",
          field as Parameters<typeof updateCounter>[2],
          10
        );

        expect(mockCtx.db.insert).toHaveBeenCalledWith(
          "counters",
          expect.objectContaining({
            [field]: 10,
          })
        );
      });

      it(`should update existing counter with ${field} field`, async () => {
        queryMock.unique.mockResolvedValue({ _id: "c1", [field]: 5 });

        await updateCounter(
          mockCtx as unknown as MutationCtx,
          "test_table",
          field as Parameters<typeof updateCounter>[2],
          10
        );

        expect(mockCtx.db.patch).toHaveBeenCalledWith(
          "c1",
          expect.objectContaining({
            [field]: 15,
          })
        );
      });

      it(`should handle undefined existing ${field} value`, async () => {
        queryMock.unique.mockResolvedValue({ _id: "c1" }); // field is missing

        await updateCounter(
          mockCtx as unknown as MutationCtx,
          "test_table",
          field as Parameters<typeof updateCounter>[2],
          10
        );

        expect(mockCtx.db.patch).toHaveBeenCalledWith(
          "c1",
          expect.objectContaining({
            [field]: 10,
          })
        );
      });
    });
  });

  describe("countUsers filter combinations", () => {
    it("should handle combination of role and isVerified (complex case)", async () => {
      queryMock.collect.mockResolvedValue([
        { _id: "p1", role: "buyer", isVerified: true },
        { _id: "p2", role: "buyer", isVerified: false },
      ]);

      const count = await countUsers(mockCtx as unknown as QueryCtx, {
        role: "buyer",
        isVerified: true,
      });

      expect(count).toBe(1);
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_role",
        expect.any(Function)
      );
    });

    it("should handle combination of kycStatus and isVerified (complex case)", async () => {
      queryMock.collect.mockResolvedValue([
        { _id: "p1", kycStatus: "verified", isVerified: true },
        { _id: "p2", kycStatus: "verified", isVerified: false },
      ]);

      const count = await countUsers(mockCtx as unknown as QueryCtx, {
        kycStatus: "verified",
        isVerified: true,
      });

      expect(count).toBe(1);
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_kycStatus",
        expect.any(Function)
      );
    });

    it("should handle no filters (complex case fallback)", async () => {
      queryMock.collect.mockResolvedValue([{ _id: "p1" }, { _id: "p2" }]);

      const count = await countUsers(mockCtx as unknown as QueryCtx, {});

      expect(count).toBe(2);
    });
  });
});
