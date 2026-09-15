import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { flagAuctionHandler } from "./mutations/publish";
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

interface MockDb {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

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

  it("should allow a user to flag a lot", async () => {
    const lotId = "lot123" as Id<"lots">;
    const reporterId = "user_reporter";
    const sellerId = "user_seller";

    const lotDoc = {
      _id: lotId,
      sellerId,
      title: "Test Lot",
      status: "approved",
    };

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]), // No existing flags
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(reporterId);

    const result = await flagAuctionHandler(mockCtx as unknown as MutationCtx, {
      lotId,
      reason: "suspicious",
      details: "Looks fake",
    });

    expect(result.success).toBe(true);
    expect(result.hideTriggered).toBe(false);
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "lotFlags",
      expect.objectContaining({
        lotId,
        reporterId,
        reason: "suspicious",
        details: "Looks fake",
        status: "pending",
      })
    );
  });

  it("should trigger auto-hide when threshold is reached", async () => {
    const lotId = "lot123" as Id<"lots">;
    const reporterId = "user_reporter_3";
    const sellerId = "user_seller";

    const lotDoc = {
      _id: lotId,
      sellerId,
      title: "To Be Hidden",
      status: "approved",
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
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(reporterId);

    const result = await flagAuctionHandler(mockCtx as unknown as MutationCtx, {
      lotId,
      reason: "other",
    });

    expect(result.hideTriggered).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", lotId, {
      status: "pending_review",
      hiddenByFlags: true,
    });
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(
      mockCtx as unknown as MutationCtx,
      "lots",
      "active",
      -1
    );
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(
      mockCtx as unknown as MutationCtx,
      "lots",
      "pending",
      1
    );
    expect(adminUtils.logAudit).toHaveBeenCalledWith(
      mockCtx as unknown as MutationCtx,
      expect.objectContaining({
        action: "AUTO_HIDE_AUCTION_FLAGS",
      })
    );
  });

  it("should throw error if lot not found", async () => {
    const lotId = "nonexistent" as Id<"lots">;
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");

    await expect(
      flagAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        reason: "other",
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should fail if user flags their own lot", async () => {
    const lotId = "lot123" as Id<"lots">;
    const userId = "user_seller";

    const lotDoc = {
      _id: lotId,
      sellerId: userId,
      title: "My Lot",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);

    await expect(
      flagAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        reason: "other",
      })
    ).rejects.toThrow("You cannot flag your own lot");
  });

  it("should fail if user already flagged the lot", async () => {
    const lotId = "lot123" as Id<"lots">;
    const userId = "user1";

    const lotDoc = {
      _id: lotId,
      sellerId: "other_user",
    };

    const existingFlags = [{ reporterId: userId, status: "pending" }];

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue(existingFlags),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(lotDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);

    await expect(
      flagAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        reason: "other",
      })
    ).rejects.toThrow("You have already flagged this lot");
  });
});
