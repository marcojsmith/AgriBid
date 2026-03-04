import { describe, it, expect, vi, beforeEach } from "vitest";

import { publishAuctionHandler } from "./mutations";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
  getCallerRole: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));

describe("publishAuction mutation", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            unique: vi.fn().mockResolvedValue(null),
          }),
        }),
      },
    };
  });

  it("should successfully transition auction status from draft to pending_review", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_123");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "draft",
      title: "Test Tractor",
      description: "A very nice tractor",
      startingPrice: 1000,
      reservePrice: 5000,
      images: { front: "storage_id" },
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
    };

    const result = await publishAuctionHandler(
      mockCtx as unknown as MutationCtx,
      args
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("auction_123", {
      status: "pending_review",
    });
  });

  it("should throw an error if the user is not authenticated", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockRejectedValue(
      new Error("Not authenticated")
    );

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
    };

    await expect(
      publishAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("Not authenticated");
  });

  it("should throw an error if the user is not the owner", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_other");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "draft",
      title: "Test Tractor",
      description: "A very nice tractor",
      startingPrice: 1000,
      reservePrice: 5000,
      images: { front: "storage_id" },
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
    };

    await expect(
      publishAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("You can only modify your own auctions");
  });

  it("should throw an error if the auction is not in draft status", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_123");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "pending_review",
      title: "Test Auction",
      description: "Test Description",
      images: { front: "storage_id" },
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
    };

    await expect(
      publishAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("Only draft auctions can be published");
  });
});
