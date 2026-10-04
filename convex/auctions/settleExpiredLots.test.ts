import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  settleExpiredLotsHandler,
  findWinningBid,
  isReserveMet,
} from "./internal";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../_generated/api", () => ({
  internal: {
    auctions: {
      settleExpiredLots: "mock-settle-expired-lots",
    },
  },
}));

interface MockCtxType {
  db: {
    query: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    system: unknown;
    normalizeId: ReturnType<typeof vi.fn>;
  };
  auth: unknown;
  storage: unknown;
  scheduler: {
    runAfter: ReturnType<typeof vi.fn>;
  };
  runMutation: unknown;
  runQuery: unknown;
  runAction: unknown;
}

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

describe("settleExpiredLots mutation", () => {
  let mockCtx: MockCtxType;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const makeQuery = (results: Record<string, unknown>[] = []) => ({
    withIndex: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    collect: vi.fn().mockResolvedValue(results),
    take: vi.fn().mockImplementation((n: number) => {
      const sliced = results.slice(0, n);
      if (results.length > n) {
        return Promise.resolve(sliced);
      }
      return Promise.resolve(sliced);
    }),
    first: vi.fn().mockResolvedValue(null),
    unique: vi.fn().mockResolvedValue(null),
    order: vi.fn().mockReturnThis(),
    [Symbol.asyncIterator]: async function* () {
      for (const item of results) {
        yield item;
      }
    },
  });

  /**
   * Builds a table-aware mock context. `lots` returns the assigned lots,
   * `bids` the bids, and `ctx.db.get` resolves the parent auction.
   *
   * @param assignedLots - Rows returned for queries against the `lots` table.
   * @param bids - Rows returned for queries against the `bids` table.
   * @param parentAuction - The auction document `ctx.db.get` resolves to.
   * @returns A mock mutation context for the settlement handler.
   */
  const setupMockCtx = (
    assignedLots: Record<string, unknown>[],
    bids: Record<string, unknown>[],
    parentAuction: Record<string, unknown> | null = {
      status: "published",
      endTime: Date.now() - 1000,
    }
  ) => {
    const tableResults: Record<string, Record<string, unknown>[]> = {
      lots: assignedLots,
      bids,
      platformFees: [],
      lotFees: [],
    };

    const mockScheduler = {
      runAfter: vi.fn().mockResolvedValue(undefined),
    };

    return {
      db: {
        // eslint-disable-next-line security/detect-object-injection -- table comes from a fixed set of test-mock table names, not user input
        query: vi.fn((table: string) => makeQuery(tableResults[table] ?? [])),
        patch: vi.fn(),
        get: vi.fn().mockResolvedValue(parentAuction),
        insert: vi.fn(),
        replace: vi.fn(),
        delete: vi.fn(),
        system: {},
        normalizeId: vi.fn((_table: string, id: string) => id),
      },
      auth: {},
      storage: {},
      scheduler: mockScheduler,
      runMutation: {},
      runQuery: {},
      runAction: {},
    } as unknown as MockCtxType;
  };

  it("should settle a lot as sold if reserve is met", async () => {
    const now = Date.now();
    const lotId = "a1" as unknown as Id<"lots">;
    const bidderId = "b1";

    const assignedLots = [
      {
        _id: lotId,
        auctionId: "auction1",
        title: "Test Auction",
        status: "assigned",
        currentPrice: 1500,
        reservePrice: 1000,
      },
    ];

    const bids = [
      {
        _id: "bid1",
        lotId,
        bidderId,
        amount: 1500,
        timestamp: now - 500,
        status: "valid",
      },
    ];

    mockCtx = setupMockCtx(assignedLots, bids);

    const result = await settleExpiredLotsHandler(
      mockCtx as unknown as MutationCtx
    );

    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "sold",
      winnerId: bidderId,
      settledAt: expect.any(Number) as number,
    });
    expect(result.hasMore).toBe(false);
  });

  it("should settle a lot as unsold if reserve is not met", async () => {
    const now = Date.now();
    const lotId = "a2" as unknown as Id<"lots">;

    const assignedLots = [
      {
        _id: lotId,
        auctionId: "auction2",
        title: "Test Auction",
        status: "assigned",
        currentPrice: 500,
        reservePrice: 1000,
      },
    ];

    const bids = [
      {
        _id: "bid2",
        lotId,
        bidderId: "b2",
        amount: 500,
        timestamp: now - 500,
        status: "valid",
      },
    ];

    mockCtx = setupMockCtx(assignedLots, bids);

    const result = await settleExpiredLotsHandler(
      mockCtx as unknown as MutationCtx
    );

    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "unsold",
      winnerId: undefined,
      settledAt: expect.any(Number) as number,
      auctionId: undefined,
    });
    expect(result.hasMore).toBe(false);
  });

  it("should settle a lot as unsold if there are no bids", async () => {
    const lotId = "a3" as unknown as Id<"lots">;

    const assignedLots = [
      {
        _id: lotId,
        auctionId: "auction3",
        title: "Test Auction",
        status: "assigned",
        currentPrice: 100,
        reservePrice: 0,
      },
    ];

    mockCtx = setupMockCtx(assignedLots, []);

    const result = await settleExpiredLotsHandler(
      mockCtx as unknown as MutationCtx
    );

    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "unsold",
      winnerId: undefined,
      settledAt: expect.any(Number) as number,
      auctionId: undefined,
    });
    expect(result.hasMore).toBe(false);
  });

  it("should pick the correct winner if there are multiple bids with the same amount", async () => {
    const now = Date.now();
    const lotId = "a4" as unknown as Id<"lots">;

    const assignedLots = [
      {
        _id: lotId,
        auctionId: "auction4",
        title: "Test Auction",
        status: "assigned",
        currentPrice: 1000,
        reservePrice: 1000,
      },
    ];

    const bids = [
      {
        _id: "bid4a",
        lotId,
        bidderId: "winner",
        amount: 1000,
        timestamp: now - 800,
        status: "valid",
      },
      {
        _id: "bid4b",
        lotId,
        bidderId: "loser",
        amount: 1000,
        timestamp: now - 700,
        status: "valid",
      },
    ];

    mockCtx = setupMockCtx(assignedLots, bids);

    await settleExpiredLotsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "sold",
      winnerId: "winner",
      settledAt: expect.any(Number) as number,
    });
  });

  it("should reschedule itself when more lots remain", async () => {
    const now = Date.now();
    const lots = Array.from({ length: 51 }, (_, i) => ({
      _id: `lot${i.toString()}` as Id<"lots">,
      auctionId: "auction1",
      title: `Lot ${i.toString()}`,
      status: "assigned",
      currentPrice: 1500,
      reservePrice: 1000,
    }));

    const bids = lots.map((lot) => ({
      _id: `bid-${lot._id}`,
      lotId: lot._id,
      bidderId: "bidder1",
      amount: 1500,
      timestamp: now - 500,
      status: "valid",
    }));

    mockCtx = setupMockCtx(lots, bids);

    const result = await settleExpiredLotsHandler(
      mockCtx as unknown as MutationCtx
    );

    expect(result.hasMore).toBe(true);
    expect(mockCtx.scheduler.runAfter).toHaveBeenCalledWith(
      0,
      expect.anything(),
      {}
    );
  });
});

describe("findWinningBid helper", () => {
  it("should return undefined for no bids", async () => {
    const mockDb = {
      query: vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        [Symbol.asyncIterator]: async function* () {
          // Empty generator
        },
      }),
    };

    const result = await findWinningBid(
      { db: mockDb } as unknown as MutationCtx,
      "lot1" as Id<"lots">
    );
    expect(result).toBeUndefined();
  });

  it("should skip voided bids", async () => {
    const bids = [
      {
        _id: "b1",
        lotId: "lot1",
        bidderId: "u1",
        amount: 100,
        timestamp: 100,
        status: "voided",
      },
      {
        _id: "b2",
        lotId: "lot1",
        bidderId: "u2",
        amount: 90,
        timestamp: 110,
        status: "valid",
      },
    ];

    const mockDb = {
      query: vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        [Symbol.asyncIterator]: async function* () {
          for (const bid of bids) {
            yield bid;
          }
        },
      }),
    };

    const result = await findWinningBid(
      { db: mockDb } as unknown as MutationCtx,
      "lot1" as Id<"lots">
    );
    expect(result).toBeDefined();
    expect(result?.bidderId).toBe("u2");
    expect(result?.amount).toBe(90);
  });

  it("should return highest valid bid, tie-breaking by earlier timestamp", async () => {
    const bids = [
      {
        _id: "b1",
        lotId: "lot1",
        bidderId: "winner",
        amount: 100,
        timestamp: 100,
        status: "valid",
      },
      {
        _id: "b2",
        lotId: "lot1",
        bidderId: "loser",
        amount: 100,
        timestamp: 150,
        status: "valid",
      },
      {
        _id: "b3",
        lotId: "lot1",
        bidderId: "other",
        amount: 90,
        timestamp: 90,
        status: "valid",
      },
    ];

    const mockDb = {
      query: vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        [Symbol.asyncIterator]: async function* () {
          for (const bid of bids) {
            yield bid;
          }
        },
      }),
    };

    const result = await findWinningBid(
      { db: mockDb } as unknown as MutationCtx,
      "lot1" as Id<"lots">
    );
    expect(result).toBeDefined();
    expect(result?.bidderId).toBe("winner");
    expect(result?.amount).toBe(100);
  });
});

describe("isReserveMet helper", () => {
  it("should return true when bid meets reserve", () => {
    expect(isReserveMet(1000, 1000)).toBe(true);
    expect(isReserveMet(1500, 1000)).toBe(true);
  });

  it("should return false when bid does not meet reserve", () => {
    expect(isReserveMet(999, 1000)).toBe(false);
    expect(isReserveMet(500, 1000)).toBe(false);
  });
});
