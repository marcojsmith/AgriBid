import { describe, it, expect, vi, beforeEach } from "vitest";

import { settleExpiredAuctionsHandler } from "./internal";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

describe("settleExpiredAuctions mutation", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (expiredAuctions: any[], bids: any[]) => {
    const mockDb = {
      query: vi.fn((table: string) => ({
        withIndex: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue(table === "auctions" ? expiredAuctions : bids),
      })),
      patch: vi.fn(),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should settle an auction as sold if reserve is met", async () => {
    const now = Date.now();
    const auctionId = "a1" as Id<"auctions">;
    const bidderId = "b1" as any;
    
    const expiredAuctions = [{
      _id: auctionId,
      title: "Test Auction",
      status: "active",
      endTime: now - 1000,
      currentPrice: 1500,
      reservePrice: 1000,
    }];

    const bids = [{
      _id: "bid1",
      auctionId,
      bidderId,
      amount: 1500,
      timestamp: now - 500,
      status: "placed",
    }];

    mockCtx = setupMockCtx(expiredAuctions, bids);

    await settleExpiredAuctionsHandler(mockCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "sold",
      winnerId: bidderId,
    });
  });

  it("should settle an auction as unsold if reserve is not met", async () => {
    const now = Date.now();
    const auctionId = "a2" as Id<"auctions">;
    
    const expiredAuctions = [{
      _id: auctionId,
      title: "Test Auction",
      status: "active",
      endTime: now - 1000,
      currentPrice: 500,
      reservePrice: 1000,
    }];

    const bids = [{
      _id: "bid2",
      auctionId,
      bidderId: "b2" as any,
      amount: 500,
      timestamp: now - 500,
      status: "placed",
    }];

    mockCtx = setupMockCtx(expiredAuctions, bids);

    await settleExpiredAuctionsHandler(mockCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "unsold",
      winnerId: undefined,
    });
  });

  it("should settle an auction as unsold if there are no bids", async () => {
    const now = Date.now();
    const auctionId = "a3" as Id<"auctions">;
    
    const expiredAuctions = [{
      _id: auctionId,
      title: "Test Auction",
      status: "active",
      endTime: now - 1000,
      currentPrice: 100,
      reservePrice: 0, // Reserve is 0 but no bids
    }];

    mockCtx = setupMockCtx(expiredAuctions, []);

    await settleExpiredAuctionsHandler(mockCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "unsold",
      winnerId: undefined,
    });
  });

  it("should pick the correct winner if there are multiple bids with the same amount", async () => {
    const now = Date.now();
    const auctionId = "a4" as Id<"auctions">;
    
    const expiredAuctions = [{
      _id: auctionId,
      title: "Test Auction",
      status: "active",
      endTime: now - 1000,
      currentPrice: 1000,
      reservePrice: 1000,
    }];

    const bids = [
      {
        _id: "bid4a",
        auctionId,
        bidderId: "winner" as any,
        amount: 1000,
        timestamp: now - 800, // Earlier bid wins
        status: "placed",
      },
      {
        _id: "bid4b",
        auctionId,
        bidderId: "loser" as any,
        amount: 1000,
        timestamp: now - 700,
        status: "placed",
      }
    ];

    mockCtx = setupMockCtx(expiredAuctions, bids);

    await settleExpiredAuctionsHandler(mockCtx);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "sold",
      winnerId: "winner",
    });
  });
});
