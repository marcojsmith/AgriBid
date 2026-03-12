import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getCounter,
  countQuery,
  sumQuery,
  countUsers,
  logAudit,
  updateCounter,
} from "./admin_utils";
import * as auth from "./lib/auth";
import type { MutationCtx, QueryCtx } from "./_generated/server";

vi.mock("./lib/auth", () => ({
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
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
      withIndex: vi.fn().mockReturnThis(),
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

  describe("getCounter", () => {
    it("should fetch counter by name", async () => {
      await getCounter(mockCtx as unknown as QueryCtx, "test");
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_name",
        expect.any(Function)
      );
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

    it("should use index for single filters without counter", async () => {
      queryMock.count?.mockResolvedValue(5);
      await countUsers(mockCtx as unknown as QueryCtx, { role: "admin" });
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_role",
        expect.any(Function)
      );
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

    it("should handle complex multiple filters via in-memory filtering", async () => {
      queryMock.collect.mockResolvedValue([
        { role: "buyer", isVerified: true, kycStatus: "verified" },
        { role: "seller", isVerified: true, kycStatus: "verified" },
        { role: "buyer", isVerified: false, kycStatus: "pending" },
      ]);
      const result = await countUsers(mockCtx as unknown as QueryCtx, {
        role: "buyer",
        isVerified: true,
      });
      expect(result).toBe(1);
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

    it("should handle counter update failure gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      // Mock updateCounter to fail
      queryMock.unique.mockRejectedValue(new Error("Counter Fail"));
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await logAudit(mockCtx as unknown as MutationCtx, { action: "test" });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
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
});
