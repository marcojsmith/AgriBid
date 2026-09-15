import { describe, it, expect, vi, beforeEach } from "vitest";

import { closeAuctionEarlyHandler } from "./mutations/publish";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  tryRequireAdmin: vi.fn(),
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

interface MockCtx {
  db: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    system: unknown;
    normalizeId: ReturnType<typeof vi.fn>;
  };
  auth: {
    getUserIdentity: ReturnType<typeof vi.fn>;
  };
  storage: unknown;
  scheduler: unknown;
  runMutation: unknown;
  runQuery: unknown;
  runAction: unknown;
}

interface MockUser {
  userId?: string | null;
  _id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  _creationTime?: number;
}

describe("closeAuctionEarly mutation", () => {
  let mockCtx: MockCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: unknown = {}) => {
    return {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        replace: vi.fn(),
        delete: vi.fn(),
        query: vi.fn(() => mockQuery),
        system: {},
        normalizeId: vi.fn((_table: string, id: string) => id),
      },
      auth: {
        getUserIdentity: vi.fn(),
      },
    } as unknown as MockCtx;
  };

  it("should mark lot as sold if reserve is met", async () => {
    const lotId = "lot123" as Id<"lots">;
    const bidderId = "bidder123";
    const lotDoc = {
      _id: lotId,
      status: "assigned",
      sellerId: "seller1",
      currentPrice: 1100,
      reservePrice: 1000,
      title: "Test Auction",
    };
    const bids = [{ bidderId, amount: 1100, timestamp: 100, status: "placed" }];

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(bids),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { _id: "admin", userId: "admin" },
    });
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      userId: "admin1",
      _id: "admin1",
    } as MockUser);
    vi.mocked(auth.resolveUserId).mockReturnValue("admin1");

    const result = await closeAuctionEarlyHandler(
      mockCtx as unknown as MutationCtx,
      { lotId }
    );

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("sold");
    expect(result.winnerId).toBe(bidderId);
    expect(result.winningAmount).toBe(1100);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "sold",
      winnerId: bidderId,
      settledAt: expect.any(Number) as number,
    });
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(
      mockCtx as unknown as MutationCtx,
      "lots",
      "active",
      -1
    );
    expect(mockCtx.db.query).toHaveBeenCalledWith("bids");
    expect(mockQuery.withIndex).toHaveBeenCalledWith(
      "by_lot",
      expect.any(Function)
    );
  });

  it("should mark lot as unsold if reserve is not met", async () => {
    const lotId = "lot123" as Id<"lots">;
    const lotDoc = {
      _id: lotId,
      status: "assigned",
      reservePrice: 2000,
      title: "Test Auction",
    };
    const bids = [
      { bidderId: "bidder123", amount: 1500, timestamp: 100, status: "placed" },
    ];

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(bids),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { _id: "admin", userId: "admin" },
    });

    const result = await closeAuctionEarlyHandler(
      mockCtx as unknown as MutationCtx,
      { lotId }
    );

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("unsold");
    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "unsold",
      winnerId: undefined,
      settledAt: expect.any(Number) as number,
    });
  });

  it("should return error if not authorized", async () => {
    mockCtx = setupMockCtx();
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: false,
      error: "Not authorized",
    });

    const result = await closeAuctionEarlyHandler(
      mockCtx as unknown as MutationCtx,
      {
        lotId: "a1" as Id<"lots">,
      }
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authorized/i);
  });

  it("should return error if lot not found", async () => {
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { _id: "admin", userId: "admin" },
    });

    const result = await closeAuctionEarlyHandler(
      mockCtx as unknown as MutationCtx,
      {
        lotId: "a1" as Id<"lots">,
      }
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("Lot not found");
  });

  it("should handle tie-break - earlier bid wins when amounts are equal", async () => {
    const lotId = "lot123" as Id<"lots">;
    const earlierBidderId = "bidder_earlier";
    const laterBidderId = "bidder_later";
    const lotDoc = {
      _id: lotId,
      status: "assigned",
      sellerId: "seller1",
      currentPrice: 1100,
      reservePrice: 1000,
      title: "Test Auction",
    };
    const bids = [
      {
        bidderId: laterBidderId,
        amount: 1500,
        timestamp: 200,
        status: "placed",
      },
      {
        bidderId: earlierBidderId,
        amount: 1500,
        timestamp: 100,
        status: "placed",
      },
    ];

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(bids),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { _id: "admin", userId: "admin" },
    });
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      userId: "admin1",
      _id: "admin1",
    } as MockUser);
    vi.mocked(auth.resolveUserId).mockReturnValue("admin1");

    const result = await closeAuctionEarlyHandler(
      mockCtx as unknown as MutationCtx,
      { lotId }
    );

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("sold");
    expect(result.winnerId).toBe(earlierBidderId);
    expect(result.winningAmount).toBe(1500);
  });

  it("should handle lot that is already settled", async () => {
    const lotId = "lot123" as Id<"lots">;
    const lotDoc = {
      _id: lotId,
      status: "sold",
      reservePrice: 1000,
      title: "Test Auction",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { _id: "admin", userId: "admin" },
    });

    const result = await closeAuctionEarlyHandler(
      mockCtx as unknown as MutationCtx,
      { lotId }
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Lot has already been settled");
  });

  it("should handle lot with no bids", async () => {
    const lotId = "lot123" as Id<"lots">;
    const lotDoc = {
      _id: lotId,
      status: "assigned",
      sellerId: "seller1",
      currentPrice: 1100,
      reservePrice: 1000,
      title: "Test Auction",
    };

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { _id: "admin", userId: "admin" },
    });

    const result = await closeAuctionEarlyHandler(
      mockCtx as unknown as MutationCtx,
      { lotId }
    );

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("unsold");
    expect(result.winnerId).toBeUndefined();
    expect(result.winningAmount).toBeUndefined();
  });

  it("should filter out voided bids", async () => {
    const lotId = "lot123" as Id<"lots">;
    const validBidderId = "valid_bidder";
    const lotDoc = {
      _id: lotId,
      status: "assigned",
      sellerId: "seller1",
      currentPrice: 1100,
      reservePrice: 1000,
      title: "Test Auction",
    };
    const bids = [
      {
        bidderId: "voided_bidder",
        amount: 2000,
        timestamp: 100,
        status: "voided",
      },
      {
        bidderId: validBidderId,
        amount: 1500,
        timestamp: 200,
        status: "placed",
      },
    ];

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(bids),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { _id: "admin", userId: "admin" },
    });
    vi.mocked(auth.getAuthUser).mockResolvedValue({
      userId: "admin1",
      _id: "admin1",
    } as MockUser);
    vi.mocked(auth.resolveUserId).mockReturnValue("admin1");

    const result = await closeAuctionEarlyHandler(
      mockCtx as unknown as MutationCtx,
      { lotId }
    );

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("sold");
    expect(result.winnerId).toBe(validBidderId);
    expect(result.winningAmount).toBe(1500);
  });
});
