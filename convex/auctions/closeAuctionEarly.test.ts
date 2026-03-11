/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { closeAuctionEarlyHandler } from "./mutations";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    name = "UnauthorizedError";
  },
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

describe("closeAuctionEarly mutation", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: any = {}) => {
    const mockDb = {
      get: vi.fn(),
      patch: vi.fn(),
      query: vi.fn(() => mockQuery),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should mark auction as sold if reserve is met", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const bidderId = "bidder123";
    const auctionDoc = {
      _id: auctionId,
      status: "active",
      reservePrice: 1000,
      title: "Test Auction",
    };
    const bids = [
      { bidderId, amount: 1100, timestamp: 100, status: "placed" }
    ];

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(bids),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
    vi.mocked(auth.getAuthUser).mockResolvedValue({ userId: "admin1" } as any);
    vi.mocked(auth.resolveUserId).mockReturnValue("admin1");

    const result = await closeAuctionEarlyHandler(mockCtx, { auctionId });

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("sold");
    expect(result.winnerId).toBe(bidderId);
    expect(result.winningAmount).toBe(1100);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "sold",
      winnerId: bidderId,
    });
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(mockCtx, "auctions", "active", -1);
  });

  it("should mark auction as unsold if reserve is not met", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const auctionDoc = {
      _id: auctionId,
      status: "active",
      reservePrice: 2000,
      title: "Test Auction",
    };
    const bids = [
      { bidderId: "bidder123", amount: 1500, timestamp: 100, status: "placed" }
    ];

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(bids),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);

    const result = await closeAuctionEarlyHandler(mockCtx, { auctionId });

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("unsold");
    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "unsold",
      winnerId: undefined,
    });
  });

  it("should return error if not authorized", async () => {
    mockCtx = setupMockCtx();
    vi.mocked(auth.requireAdmin).mockRejectedValue(new (auth as any).UnauthorizedError("Not authorized"));

    const result = await closeAuctionEarlyHandler(mockCtx, { auctionId: "a1" as any });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authorized/i);
  });

  it("should return error if auction not found", async () => {
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);

    const result = await closeAuctionEarlyHandler(mockCtx, { auctionId: "a1" as any });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Auction not found");
  });
});
