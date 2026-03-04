import { describe, it, expect, vi, beforeEach } from "vitest";

import { updateAuctionHandler } from "./mutations";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
  getCallerRole: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));

describe("updateAuction mutation", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
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
      },
    };
  });

  it("should update the auction successfully if the user is the seller and auction is draft", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_123");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "draft",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      updates: { title: "New Title" },
    };

    const result = await updateAuctionHandler(
      mockCtx as unknown as MutationCtx,
      args
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("auction_123", {
      title: "New Title",
    });
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "auditLogs",
      expect.anything()
    );
  });

  it("should throw an error if the user is not authenticated", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockRejectedValue(
      new Error("Not authenticated")
    );

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      updates: { title: "New Title" },
    };

    await expect(
      updateAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("Not authenticated");
  });

  it("should throw an error if the user is not the seller", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_other");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "draft",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      updates: { title: "New Title" },
    };

    await expect(
      updateAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("You can only modify your own auctions");
  });

  it("should throw an error if the auction is not in draft or pending_review", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_123");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      status: "active",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      updates: { title: "New Title" },
    };

    await expect(
      updateAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("Only draft or pending_review auctions can be edited");
  });
});
