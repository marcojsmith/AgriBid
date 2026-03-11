import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { flagAuctionHandler } from "./mutations";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

type MockDb = {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
};

type MockCtxType = {
  db: MockDb;
} & Partial<MutationCtx>;

describe("flagAuction mutation", () => {
  let mockCtx: MockCtxType;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: unknown = {}) => {
    const mockDb: MockDb = {
      get: vi.fn(),
      patch: vi.fn(),
      insert: vi.fn(),
      query: vi.fn(() => mockQuery),
    };
    return {
      db: mockDb,
    } as unknown as MockCtxType;
  };

  it("should allow a user to flag an auction", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const reporterId = "user_reporter";
    const sellerId = "user_seller";

    const auctionDoc = {
      _id: auctionId,
      sellerId,
      title: "Test Auction",
      status: "active",
    };

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]), // No existing flags
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(reporterId);

    const result = await flagAuctionHandler(mockCtx as unknown as MutationCtx, {
      auctionId,
      reason: "suspicious",
      details: "Looks fake",
    });

    expect(result.success).toBe(true);
    expect(result.hideTriggered).toBe(false);
    expect(mockCtx.db.insert).toHaveBeenCalledWith("auctionFlags", expect.objectContaining({
      auctionId,
      reporterId,
      reason: "suspicious",
      details: "Looks fake",
      status: "pending",
    }));
  });

  it("should trigger auto-hide when threshold is reached", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const reporterId = "user_reporter_3";
    const sellerId = "user_seller";

    const auctionDoc = {
      _id: auctionId,
      sellerId,
      title: "To Be Hidden",
      status: "active",
    };

    // Existing pending flags (threshold is 3, so 2 existing + 1 new = 3)
    const existingFlags = [
      { reporterId: "user1", status: "pending" },
      { reporterId: "user2", status: "pending" },
    ];

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(existingFlags),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(reporterId);

    const result = await flagAuctionHandler(mockCtx as unknown as MutationCtx, {
      auctionId,
      reason: "other",
    });

    expect(result.hideTriggered).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      status: "pending_review",
      hiddenByFlags: true,
    });
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(mockCtx as unknown as MutationCtx, "auctions", "active", -1);
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(mockCtx as unknown as MutationCtx, "auctions", "pending", 1);
    expect(adminUtils.logAudit).toHaveBeenCalledWith(mockCtx as unknown as MutationCtx, expect.objectContaining({
      action: "AUTO_HIDE_AUCTION_FLAGS",
    }));
  });

  it("should throw error if auction not found", async () => {
    const auctionId = "nonexistent" as Id<"auctions">;
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");

    await expect(flagAuctionHandler(mockCtx as unknown as MutationCtx, {
      auctionId,
      reason: "other",
    })).rejects.toThrow(ConvexError);
  });

  it("should fail if user flags their own auction", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const userId = "user_seller";

    const auctionDoc = {
      _id: auctionId,
      sellerId: userId,
      title: "My Auction",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);

    await expect(flagAuctionHandler(mockCtx as unknown as MutationCtx, {
      auctionId,
      reason: "other",
    })).rejects.toThrow("You cannot flag your own auction");
  });

  it("should fail if user already flagged the auction", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const userId = "user1";

    const auctionDoc = {
      _id: auctionId,
      sellerId: "other_user",
    };

    const existingFlags = [
      { reporterId: userId, status: "pending" },
    ];

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(existingFlags),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);

    await expect(flagAuctionHandler(mockCtx as unknown as MutationCtx, {
      auctionId,
      reason: "other",
    })).rejects.toThrow("You have already flagged this auction");
  });
});
