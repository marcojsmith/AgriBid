import { describe, it, expect, vi, beforeEach } from "vitest";

import { adminUpdateAuctionHandler } from "./mutations";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  getAuthUser: vi.fn().mockResolvedValue({ id: "admin123" }),
  resolveUserId: vi.fn((user) => user.id),
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

type MockCtxType = {
  db: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
};

describe("adminUpdateAuction mutation", () => {
  let mockCtx: MockCtxType;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
      },
    };
  });

  it("should update an auction as admin", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const mockAuction = {
      _id: auctionId,
      status: "pending_review",
      title: "Test Auction",
      endTime: Date.now() + 86400000,
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const result = await adminUpdateAuctionHandler(
      mockCtx as unknown as MutationCtx,
      {
        auctionId,
        updates: { status: "active" },
      }
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      auctionId,
      expect.objectContaining({ status: "active" })
    );
  });

  it("should throw error if auction not found", async () => {
    const auctionId = "invalid" as Id<"auctions">;
    mockCtx.db.get.mockResolvedValue(null);

    await expect(
      adminUpdateAuctionHandler(mockCtx as unknown as MutationCtx, {
        auctionId,
        updates: { status: "active" },
      })
    ).rejects.toThrow("Auction not found");
  });
});
