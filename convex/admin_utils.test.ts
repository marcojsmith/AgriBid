/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getCounter,
  countQuery,
  sumQuery,
  countUsers,
  logAudit,
  updateCounter,
} from "./admin_utils";
import type { MutationCtx, QueryCtx } from "./_generated/server";

describe("getCounter", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should retrieve a counter by name", async () => {
    const mockCounter = {
      _id: "counter_1",
      name: "auctions",
      total: 100,
      active: 50,
    };

    mockCtx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(mockCounter),
        })),
      },
    } as unknown as QueryCtx;

    const result = await getCounter(mockCtx, "auctions");

    expect(result).toEqual(mockCounter);
  });

  it("should return null if counter not found", async () => {
    mockCtx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
        })),
      },
    } as unknown as QueryCtx;

    const result = await getCounter(mockCtx, "nonexistent");

    expect(result).toBeNull();
  });
});

describe("countQuery", () => {
  it("should use .count() if available", async () => {
    const mockQuery = {
      count: vi.fn().mockResolvedValue(42),
      collect: vi.fn(),
    };

    const result = await countQuery(mockQuery);

    expect(result).toBe(42);
    expect(mockQuery.count).toHaveBeenCalled();
    expect(mockQuery.collect).not.toHaveBeenCalled();
  });

  it("should fall back to .collect() if .count() not available", async () => {
    const mockQuery = {
      collect: vi.fn().mockResolvedValue([1, 2, 3, 4, 5]),
    };

    const result = await countQuery(mockQuery);

    expect(result).toBe(5);
    expect(mockQuery.collect).toHaveBeenCalled();
  });
});

describe("sumQuery", () => {
  it("should sum numeric field values", async () => {
    const mockQuery = {
      collect: vi
        .fn()
        .mockResolvedValue([{ amount: 100 }, { amount: 200 }, { amount: 300 }]),
    };

    const result = await sumQuery(mockQuery, "amount");

    expect(result.sum).toBe(600);
    expect(result.count).toBe(3);
  });

  it("should skip non-numeric values", async () => {
    const mockQuery = {
      collect: vi
        .fn()
        .mockResolvedValue([
          { amount: 100 },
          { amount: "invalid" },
          { amount: 300 },
        ]),
    };

    const result = await sumQuery(mockQuery, "amount");

    expect(result.sum).toBe(400);
    expect(result.count).toBe(2);
  });

  it("should handle empty results", async () => {
    const mockQuery = {
      collect: vi.fn().mockResolvedValue([]),
    };

    const result = await sumQuery(mockQuery, "amount");

    expect(result.sum).toBe(0);
    expect(result.count).toBe(0);
  });
});

describe("countUsers", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (counterValue?: any, profiles: any[] = []) => {
    return {
      db: {
        query: vi.fn((table: string) => {
          if (table === "counters") {
            return {
              withIndex: vi.fn().mockReturnThis(),
              unique: vi.fn().mockResolvedValue(counterValue),
            };
          }
          if (table === "profiles") {
            return {
              withIndex: vi.fn().mockReturnThis(),
              filter: vi.fn().mockReturnThis(),
              collect: vi.fn().mockResolvedValue(profiles),
              count: vi.fn().mockResolvedValue(profiles.length),
            };
          }
          return {
            withIndex: vi.fn().mockReturnThis(),
            collect: vi.fn().mockResolvedValue([]),
          };
        }),
      },
    } as unknown as QueryCtx;
  };

  it("should use counter for total without filters", async () => {
    mockCtx = setupMockCtx({
      name: "profiles",
      total: 100,
    });

    const result = await countUsers(mockCtx, { useCounter: true });

    expect(result).toBe(100);
  });

  it("should use counter for verified count", async () => {
    mockCtx = setupMockCtx({
      name: "profiles",
      total: 100,
      verified: 50,
    });

    const result = await countUsers(mockCtx, {
      isVerified: true,
      useCounter: true,
    });

    expect(result).toBe(50);
  });

  it("should use counter for pending KYC count", async () => {
    mockCtx = setupMockCtx({
      name: "profiles",
      total: 100,
      pending: 20,
    });

    const result = await countUsers(mockCtx, {
      kycStatus: "pending",
      useCounter: true,
    });

    expect(result).toBe(20);
  });

  it("should use database query when filtering by role", async () => {
    const profiles = [
      { userId: "1", role: "admin", isVerified: true },
      { userId: "2", role: "admin", isVerified: false },
    ];
    mockCtx = setupMockCtx(null, profiles);

    const result = await countUsers(mockCtx, { role: "admin" });

    expect(result).toBe(2);
  });

  it("should handle multiple filters with in-memory filtering", async () => {
    const profiles = [
      { userId: "1", role: "buyer", isVerified: true, kycStatus: "verified" },
      { userId: "2", role: "buyer", isVerified: false, kycStatus: "pending" },
      { userId: "3", role: "seller", isVerified: true, kycStatus: "verified" },
    ];
    mockCtx = setupMockCtx(null, profiles);

    const result = await countUsers(mockCtx, {
      role: "buyer",
      isVerified: true,
    });

    expect(result).toBe(1);
  });

  it("should return 0 when no matches found", async () => {
    mockCtx = setupMockCtx(null, []);

    const result = await countUsers(mockCtx, { role: "admin" });

    expect(result).toBe(0);
  });
});

describe("logAudit", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (authUser: any = null) => {
    return {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue(authUser),
      },
      db: {
        insert: vi.fn().mockResolvedValue("audit_log_123"),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
        })),
      },
    } as unknown as MutationCtx;
  };

  it("should create audit log with authenticated user", async () => {
    mockCtx = setupMockCtx({ userId: "user_123", _id: "auth_123" });

    await logAudit(mockCtx, {
      action: "UPDATE_AUCTION",
      targetId: "auction_123",
      targetType: "auction",
      details: "Updated auction details",
    });

    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "auditLogs",
      expect.objectContaining({
        adminId: "user_123",
        action: "UPDATE_AUCTION",
        targetId: "auction_123",
        targetType: "auction",
        details: "Updated auction details",
      })
    );
  });

  it("should use SYSTEM for system actions", async () => {
    mockCtx = setupMockCtx(null);

    await logAudit(mockCtx, {
      action: "SYSTEM_CLEANUP",
      system: true,
    });

    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "auditLogs",
      expect.objectContaining({
        adminId: "SYSTEM",
        action: "SYSTEM_CLEANUP",
      })
    );
  });

  it("should use UNAUTHENTICATED when no user and not system", async () => {
    mockCtx = setupMockCtx(null);

    await logAudit(mockCtx, {
      action: "ANONYMOUS_ACTION",
    });

    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "auditLogs",
      expect.objectContaining({
        adminId: "UNAUTHENTICATED",
        action: "ANONYMOUS_ACTION",
      })
    );
  });

  it("should include targetCount when provided", async () => {
    mockCtx = setupMockCtx({ userId: "admin_123", _id: "auth_123" });

    await logAudit(mockCtx, {
      action: "BULK_DELETE",
      targetCount: 10,
    });

    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "auditLogs",
      expect.objectContaining({
        action: "BULK_DELETE",
        targetCount: 10,
      })
    );
  });
});

describe("updateCounter", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (counterExists: boolean = false, currentValue = 10) => {
    const mockCounter = counterExists
      ? {
          _id: "counter_123",
          name: "auctions",
          total: currentValue,
          active: 5,
          pending: 2,
          verified: 0,
          open: 0,
          resolved: 0,
          draft: 3,
          salesVolume: 0,
          soldCount: 0,
        }
      : null;

    return {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(mockCounter),
        })),
        patch: vi.fn(),
        insert: vi.fn().mockResolvedValue("counter_new"),
      },
    } as unknown as MutationCtx;
  };

  it("should increment existing counter", async () => {
    mockCtx = setupMockCtx(true, 10);

    await updateCounter(mockCtx, "auctions", "total", 5);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "counter_123",
      expect.objectContaining({
        total: 15,
      })
    );
  });

  it("should decrement existing counter", async () => {
    mockCtx = setupMockCtx(true, 10);

    await updateCounter(mockCtx, "auctions", "total", -3);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "counter_123",
      expect.objectContaining({
        total: 7,
      })
    );
  });

  it("should create new counter if not exists", async () => {
    mockCtx = setupMockCtx(false);

    await updateCounter(mockCtx, "auctions", "total", 5);

    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "counters",
      expect.objectContaining({
        name: "auctions",
        total: 5,
      })
    );
  });

  it("should set absolute value when absolute flag is true", async () => {
    mockCtx = setupMockCtx(true, 10);

    await updateCounter(mockCtx, "auctions", "total", 50, true);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "counter_123",
      expect.objectContaining({
        total: 50,
      })
    );
  });

  it("should clamp negative values to 0", async () => {
    mockCtx = setupMockCtx(true, 5);

    await updateCounter(mockCtx, "auctions", "total", -10);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "counter_123",
      expect.objectContaining({
        total: 0,
      })
    );
  });

  it("should handle different counter fields", async () => {
    mockCtx = setupMockCtx(true, 10);

    await updateCounter(mockCtx, "auctions", "active", 2);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "counter_123",
      expect.objectContaining({
        active: 7,
      })
    );
  });

  it("should initialize missing fields to 0", async () => {
    const mockCounter = {
      _id: "counter_123",
      name: "auctions",
      total: 10,
    };

    mockCtx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(mockCounter),
        })),
        patch: vi.fn(),
      },
    } as unknown as MutationCtx;

    await updateCounter(mockCtx, "auctions", "pending", 3);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "counter_123",
      expect.objectContaining({
        pending: 3,
      })
    );
  });
});
