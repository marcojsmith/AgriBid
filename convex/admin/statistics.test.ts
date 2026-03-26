import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getAdminStats,
  getFinancialStats,
  initializeCounters,
  getAnnouncementStats,
  getSupportStats,
  initializeCountersHandler,
  getAdminStatsHandler,
} from "./statistics";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
  _getCallerRoleFromAuthUser: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  getCounter: vi.fn(),
  countQuery: vi.fn(),
  countUsers: vi.fn(),
  updateCounter: vi.fn(),
}));

vi.mock("../_generated/server", () => ({
  query: vi.fn((q) => q),
  mutation: vi.fn((m) => m),
}));

vi.mock("../presence", () => ({
  countOnlineUsers: vi.fn(),
}));

vi.mock("../constants", () => ({
  MS_PER_DAY: 86400000,
}));

vi.mock("../support", () => ({}));

interface MockQuery {
  withIndex: (index: string, cb?: (q: unknown) => unknown) => MockQuery;
  filter: (cb: (q: unknown) => unknown) => MockQuery;
  unique: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
  paginate: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  take: ReturnType<typeof vi.fn>;
}

interface MockCtx {
  db: {
    query: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
}

describe("Admin Statistics", () => {
  let mockCtx: MockCtx;
  let queryMock: MockQuery;

  beforeEach(() => {
    vi.resetAllMocks();

    const mockQ = {
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
    };

    queryMock = {
      withIndex: vi.fn((cb) => {
        if (typeof cb === "function") cb(mockQ);
        return queryMock;
      }),
      filter: vi.fn((cb) => {
        if (typeof cb === "function") cb(mockQ);
        return queryMock;
      }),
      unique: vi.fn().mockResolvedValue(null),
      collect: vi.fn().mockResolvedValue([]),
      paginate: vi.fn().mockResolvedValue({
        page: [{ currentPrice: 500 }],
        continueCursor: null,
        isDone: true,
      }),
      order: vi.fn().mockReturnThis(),
      take: vi.fn().mockResolvedValue([]),
    };

    mockCtx = {
      db: {
        query: vi.fn(() => queryMock),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  it("getAdminStats should return healthy status when counters are found", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      total: 10,
      active: 5,
      pending: 2,
    } as Doc<"counters">);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(0);

    const stats = await (
      getAdminStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {});

    expect(stats).toMatchObject({
      status: "healthy",
      totalAuctions: 10,
    });
  });

  it("getAdminStats should return partial status when counters are missing", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue(null);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(0);

    const stats = await (
      getAdminStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {});

    expect(stats).toMatchObject({
      status: "partial",
    });
  });

  it("initializeCounters should initialize counters successfully", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(5);
    vi.mocked(adminUtils.countUsers).mockResolvedValue(10);

    const result = await (
      initializeCounters as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as MutationCtx, {});

    expect(result).toMatchObject({ success: true });
  });

  it("initializeCounters should accumulate soldCount across multiple pages", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(5);
    vi.mocked(adminUtils.countUsers).mockResolvedValue(10);

    queryMock.paginate
      .mockResolvedValueOnce({
        page: [{ currentPrice: 1000 }, { currentPrice: 2000 }],
        continueCursor: "cursor1",
        isDone: false,
      })
      .mockResolvedValueOnce({
        page: [{ currentPrice: 3000 }],
        continueCursor: null,
        isDone: true,
      });

    await (
      initializeCounters as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as MutationCtx, {});

    const insertCalls = mockCtx.db.insert.mock.calls;
    const auctionsInsert = insertCalls.find(
      (call: unknown[]) =>
        call[0] === "counters" &&
        (call[1] as { name?: string })?.name === "auctions"
    );
    expect(auctionsInsert).toBeDefined();
    const insertedData = auctionsInsert?.[1] as {
      salesVolume?: number;
      soldCount?: number;
    };
    expect(insertedData.salesVolume).toBe(6000);
    expect(insertedData.soldCount).toBe(3);
  });

  it("getFinancialStats should use pagination when counter.soldCount is undefined", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      name: "auctions",
      total: 10,
      active: 5,
      salesVolume: undefined,
      soldCount: undefined,
    } as Doc<"counters">);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(5);

    queryMock.paginate.mockResolvedValueOnce({
      page: [{ currentPrice: 5000 }, { currentPrice: 3000 }],
      continueCursor: null,
      isDone: true,
    });

    const stats = (await (
      getFinancialStats as unknown as {
        handler: (...args: unknown[]) => Promise<{
          recentSales: {
            page: unknown[];
            continueCursor: string;
            totalCount: number;
          };
        }>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {})) as {
      recentSales: {
        page: unknown[];
        continueCursor: string;
        totalCount: number;
      };
    };

    expect(stats.recentSales.totalCount).toBe(5);
  });

  it("getFinancialStats should use correct startIndex for valid cursor", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      name: "auctions",
      total: 10,
      active: 5,
      salesVolume: 5000,
      soldCount: 5,
    } as Doc<"counters">);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(5);

    // Return 15 items (10 at startIndex 5 + 5 at startIndex 10)
    const allItems = Array.from({ length: 15 }, (_, i) => ({
      currentPrice: (i + 1) * 1000,
    }));
    queryMock.take.mockResolvedValue(allItems);

    const stats = (await (
      getFinancialStats as unknown as {
        handler: (...args: unknown[]) => Promise<{
          recentSales: {
            page: unknown[];
            continueCursor: string;
            totalCount: number;
          };
        }>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {
      salesPaginationOpts: { cursor: "5", numItems: 10 },
    })) as {
      recentSales: {
        page: unknown[];
        continueCursor: string;
        totalCount: number;
      };
    };

    expect(stats.recentSales.page).toHaveLength(10);
  });

  it("getFinancialStats should handle invalid cursor (non-numeric)", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      name: "auctions",
      total: 10,
      active: 5,
      salesVolume: 5000,
      soldCount: 5,
    } as Doc<"counters">);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(5);

    queryMock.take.mockResolvedValue([
      { currentPrice: 1000 },
      { currentPrice: 2000 },
    ]);

    const stats = (await (
      getFinancialStats as unknown as {
        handler: (...args: unknown[]) => Promise<{
          recentSales: {
            page: unknown[];
            continueCursor: string;
            totalCount: number;
          };
        }>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {
      salesPaginationOpts: { cursor: "abc", numItems: 10 },
    })) as {
      recentSales: {
        page: unknown[];
        continueCursor: string;
        totalCount: number;
      };
    };

    expect(stats.recentSales.page).toHaveLength(2);
  });

  it("getFinancialStats should handle negative cursor", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      name: "auctions",
      total: 10,
      active: 5,
      salesVolume: 5000,
      soldCount: 5,
    } as Doc<"counters">);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(5);

    queryMock.take.mockResolvedValue([
      { currentPrice: 1000 },
      { currentPrice: 2000 },
    ]);

    const stats = (await (
      getFinancialStats as unknown as {
        handler: (...args: unknown[]) => Promise<{
          recentSales: {
            page: unknown[];
            continueCursor: string;
            totalCount: number;
          };
        }>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {
      salesPaginationOpts: { cursor: "-5", numItems: 10 },
    })) as {
      recentSales: {
        page: unknown[];
        continueCursor: string;
        totalCount: number;
      };
    };

    expect(stats.recentSales.page).toHaveLength(2);
  });

  it("getAnnouncementStats should return counter total and recent count", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      name: "announcements",
      total: 15,
    } as Doc<"counters">);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(3);

    const stats = await (
      getAnnouncementStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx);

    expect(stats).toMatchObject({
      total: 15,
      recent: 3,
    });
  });

  it("getSupportStats should return open, resolved, total from counter", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      name: "support",
      open: 5,
      resolved: 10,
      total: 15,
    } as Doc<"counters">);

    const stats = await (
      getSupportStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx);

    expect(stats).toMatchObject({
      open: 5,
      resolved: 10,
      total: 15,
    });
  });

  it("getAnnouncementStats should handle missing counter", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue(null);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(0);

    const stats = await (
      getAnnouncementStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx);

    expect(stats).toMatchObject({
      total: 0,
      recent: 0,
    });
  });

  it("getSupportStats should handle missing counter", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue(null);

    const stats = await (
      getSupportStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx);

    expect(stats).toMatchObject({
      open: 0,
      resolved: 0,
      total: 0,
    });
  });

  it("getAdminStatsHandler should re-throw errors from getCounter", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockRejectedValue(
      new Error("Database connection failed")
    );

    await expect(
      (
        getAdminStats as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx as unknown as QueryCtx)
    ).rejects.toThrow("Database connection failed");
  });

  it("initializeCountersHandler should initialize counters from scratch", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(5);
    vi.mocked(adminUtils.countUsers).mockResolvedValue(10);
    queryMock.paginate.mockResolvedValue({
      page: [{ currentPrice: 1000 }],
      continueCursor: null,
      isDone: true,
    });

    const result = await initializeCountersHandler(
      mockCtx as unknown as MutationCtx
    );

    expect(result).toMatchObject({ success: true });
  });

  it("getAdminStatsHandler should fetch all admin stats", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      total: 100,
      active: 50,
      pending: 10,
      salesVolume: 50000,
      soldCount: 20,
    } as Doc<"counters">);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(5);

    const result = await getAdminStatsHandler(mockCtx as unknown as QueryCtx);

    expect(result.totalAuctions).toBe(100);
    expect(result.activeAuctions).toBe(50);
    expect(result.status).toBe("healthy");
  });
});
