import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getAdminStats,
  getFinancialStats,
  initializeCounters,
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

    queryMock = {
      withIndex: vi.fn(() => queryMock),
      filter: vi.fn(() => queryMock),
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

    const stats = await (
      getFinancialStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {});

    expect(stats).toMatchObject({
      totalSalesVolume: 8000,
      auctionCount: 2,
      partialResults: true,
    });
  });

  it("getFinancialStats should detect divergence and recompute when counter diverges from live", async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "u1",
    } as Awaited<ReturnType<typeof auth.requireAdmin>>);
    vi.mocked(adminUtils.getCounter).mockResolvedValue({
      name: "auctions",
      total: 10,
      active: 5,
      salesVolume: 5000,
      soldCount: 1,
    } as Doc<"counters">);
    vi.mocked(adminUtils.countQuery).mockResolvedValue(3);

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

    const stats = await (
      getFinancialStats as unknown as {
        handler: (...args: unknown[]) => Promise<unknown>;
      }
    ).handler(mockCtx as unknown as QueryCtx, {});

    expect(stats).toMatchObject({
      totalSalesVolume: 6000,
      auctionCount: 3,
      partialResults: true,
    });
  });
});
