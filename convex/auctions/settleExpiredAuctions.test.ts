import { describe, it, expect, vi, beforeEach } from "vitest";

import { settleExpiredAuctionsHandler } from "./internal";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type MockCtxType = {
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
};

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

describe("settleExpiredAuctions mutation", () => {
  let mockCtx: MockCtxType;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (
    expiredAuctions: { [key: string]: unknown }[],
    bids: { [key: string]: unknown }[]
  ) => {
    return {
      db: {
        query: vi.fn((table: string) => ({
          withIndex: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          collect: vi
            .fn()
            .mockResolvedValue(table === "auctions" ? expiredAuctions : bids),
          unique: vi.fn().mockResolvedValue(null),
          first: vi.fn().mockResolvedValue(null),
          order: vi.fn().mockReturnThis(),
        })),
        patch: vi.fn(),
        get: vi.fn(),
        insert: vi.fn(),
        replace: vi.fn(),
        delete: vi.fn(),
        system: {},
        normalizeId: vi.fn((_table: string, id: string) => id),
      },
      auth: {},
      storage: {},
      scheduler: {},
      runMutation: vi.fn().mockResolvedValue(undefined),
      runQuery: vi.fn().mockResolvedValue(undefined),
      runAction: vi.fn().mockResolvedValue(undefined),
    } as unknown as MockCtxType;
  };

  it("should settle an auction as sold if reserve is met", async () => {
    const now = Date.now();
    const auctionId = "a1" as unknown as Id<"auctions">;
    const bidderId = "b1";

    const expiredAuctions = [
      {
        _id: auctionId,
        title: "Test Auction",
        status: "active",
        endTime: now - 1000,
        currentPrice: 1500,
        reservePrice: 1000,
      },
    ];

    const bids = [
      {
        _id: "bid1",
        auctionId,
        bidderId,
        amount: 1500,
        timestamp: now - 500,
        status: "placed",
      },
    ];

    mockCtx = setupMockCtx(expiredAuctions, bids);

    await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "sold",
      winnerId: bidderId,
    });
  });

  it("should settle an auction as unsold if reserve is not met", async () => {
    const now = Date.now();
    const auctionId = "a2" as unknown as Id<"auctions">;

    const expiredAuctions = [
      {
        _id: auctionId,
        title: "Test Auction",
        status: "active",
        endTime: now - 1000,
        currentPrice: 500,
        reservePrice: 1000,
      },
    ];

    const bids = [
      {
        _id: "bid2",
        auctionId,
        bidderId: "b2",
        amount: 500,
        timestamp: now - 500,
        status: "placed",
      },
    ];

    mockCtx = setupMockCtx(expiredAuctions, bids);

    await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "unsold",
      winnerId: undefined,
    });
  });

  it("should settle an auction as unsold if there are no bids", async () => {
    const now = Date.now();
    const auctionId = "a3" as unknown as Id<"auctions">;

    const expiredAuctions = [
      {
        _id: auctionId,
        title: "Test Auction",
        status: "active",
        endTime: now - 1000,
        currentPrice: 100,
        reservePrice: 0, // Reserve is 0 but no bids
      },
    ];

    mockCtx = setupMockCtx(expiredAuctions, []);

    await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "unsold",
      winnerId: undefined,
    });
  });

  it("should pick the correct winner if there are multiple bids with the same amount", async () => {
    const now = Date.now();
    const auctionId = "a4" as unknown as Id<"auctions">;

    const expiredAuctions = [
      {
        _id: auctionId,
        title: "Test Auction",
        status: "active",
        endTime: now - 1000,
        currentPrice: 1000,
        reservePrice: 1000,
      },
    ];

    const bids = [
      {
        _id: "bid4a",
        auctionId,
        bidderId: "winner",
        amount: 1000,
        timestamp: now - 800, // Earlier bid wins
        status: "placed",
      },
      {
        _id: "bid4b",
        auctionId,
        bidderId: "loser",
        amount: 1000,
        timestamp: now - 700,
        status: "placed",
      },
    ];

    mockCtx = setupMockCtx(expiredAuctions, bids);

    await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "sold",
      winnerId: "winner",
    });
  });
});
