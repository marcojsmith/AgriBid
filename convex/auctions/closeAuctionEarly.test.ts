import { describe, it, expect, vi, beforeEach } from "vitest";

import { closeLotEarlyHandler } from "./mutations/publish";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import * as internal from "./internal";
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

vi.mock("./internal", () => ({
  findWinningBid: vi.fn(),
  isReserveMet: vi.fn(),
  calculateAndRecordFees: vi.fn(),
  logAuctionSettlementActivity: vi.fn(),
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
  scheduler: {
    runAfter: ReturnType<typeof vi.fn>;
  };
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

describe("closeLotEarly mutation", () => {
  let mockCtx: MockCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    return {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        replace: vi.fn(),
        delete: vi.fn(),
        query: vi.fn(),
        system: {},
        normalizeId: vi.fn((_table: string, id: string) => id),
      },
      auth: {
        getUserIdentity: vi.fn(),
      },
      scheduler: {
        runAfter: vi.fn(),
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
    const winningBid = {
      _id: "bid1" as Id<"bids">,
      lotId,
      bidderId,
      amount: 1100,
      timestamp: 100,
      status: "valid" as const,
      _creationTime: 100,
    };

    mockCtx = setupMockCtx();
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
    vi.mocked(internal.findWinningBid).mockResolvedValue(winningBid);
    vi.mocked(internal.isReserveMet).mockReturnValue(true);

    const result = await closeLotEarlyHandler(
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
    expect(internal.findWinningBid).toHaveBeenCalledWith(
      mockCtx as unknown as MutationCtx,
      lotId
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
    const winningBid = {
      _id: "bid1" as Id<"bids">,
      lotId,
      bidderId: "bidder123",
      amount: 1500,
      timestamp: 100,
      status: "valid" as const,
      _creationTime: 100,
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { _id: "admin", userId: "admin" },
    });
    vi.mocked(internal.findWinningBid).mockResolvedValue(winningBid);
    vi.mocked(internal.isReserveMet).mockReturnValue(false);

    const result = await closeLotEarlyHandler(
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

    const result = await closeLotEarlyHandler(
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

    const result = await closeLotEarlyHandler(
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
    const lotDoc = {
      _id: lotId,
      status: "assigned",
      sellerId: "seller1",
      currentPrice: 1100,
      reservePrice: 1000,
      title: "Test Auction",
    };
    const winningBid = {
      _id: "bid1" as Id<"bids">,
      lotId,
      bidderId: earlierBidderId,
      amount: 1500,
      timestamp: 100,
      status: "valid" as const,
      _creationTime: 100,
    };

    mockCtx = setupMockCtx();
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
    vi.mocked(internal.findWinningBid).mockResolvedValue(winningBid);
    vi.mocked(internal.isReserveMet).mockReturnValue(true);

    const result = await closeLotEarlyHandler(
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

    const result = await closeLotEarlyHandler(
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

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.tryRequireAdmin).mockResolvedValue({
      authorized: true,
      user: { _id: "admin", userId: "admin" },
    });
    vi.mocked(internal.findWinningBid).mockResolvedValue(undefined);

    const result = await closeLotEarlyHandler(
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
    const winningBid = {
      _id: "bid1" as Id<"bids">,
      lotId,
      bidderId: validBidderId,
      amount: 1500,
      timestamp: 200,
      status: "valid" as const,
      _creationTime: 200,
    };

    mockCtx = setupMockCtx();
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
    vi.mocked(internal.findWinningBid).mockResolvedValue(winningBid);
    vi.mocked(internal.isReserveMet).mockReturnValue(true);

    const result = await closeLotEarlyHandler(
      mockCtx as unknown as MutationCtx,
      { lotId }
    );

    expect(result.success).toBe(true);
    expect(result.finalStatus).toBe("sold");
    expect(result.winnerId).toBe(validBidderId);
    expect(result.winningAmount).toBe(1500);
  });
});
