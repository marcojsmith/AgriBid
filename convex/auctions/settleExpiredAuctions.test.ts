import { describe, it, expect, vi, beforeEach } from "vitest";

import { settleExpiredAuctionsHandler } from "./internal";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

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
  scheduler: unknown;
  runMutation: unknown;
  runQuery: unknown;
  runAction: unknown;
}

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

describe("settleExpiredAuctions mutation", () => {
  let mockCtx: MockCtxType;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const makeQuery = (results: Record<string, unknown>[] = []) => ({
    withIndex: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    collect: vi.fn().mockResolvedValue(results),
    first: vi.fn().mockResolvedValue(null),
    unique: vi.fn().mockResolvedValue(null),
  });

  /**
   * Builds a table-aware mock context. `lots` returns the assigned lots,
   * `bids` the bids, and `ctx.db.get` resolves the parent auction.
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

    return {
      db: {
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
      scheduler: {},
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
        status: "placed",
      },
    ];

    mockCtx = setupMockCtx(assignedLots, bids);

    await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "sold",
      winnerId: bidderId,
      settledAt: expect.any(Number) as number,
    });
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
        status: "placed",
      },
    ];

    mockCtx = setupMockCtx(assignedLots, bids);

    await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "unsold",
      winnerId: undefined,
      settledAt: expect.any(Number) as number,
      auctionId: undefined,
    });
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
        reservePrice: 0, // Reserve is 0 but no bids
      },
    ];

    mockCtx = setupMockCtx(assignedLots, []);

    await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "unsold",
      winnerId: undefined,
      settledAt: expect.any(Number) as number,
      auctionId: undefined,
    });
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
        timestamp: now - 800, // Earlier bid wins
        status: "placed",
      },
      {
        _id: "bid4b",
        lotId,
        bidderId: "loser",
        amount: 1000,
        timestamp: now - 700,
        status: "placed",
      },
    ];

    mockCtx = setupMockCtx(assignedLots, bids);

    await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "sold",
      winnerId: "winner",
      settledAt: expect.any(Number) as number,
    });
  });
});
