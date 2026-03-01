import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateAuctionHandler } from "./mutations";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
  getCallerRole: vi.fn(),
}));

describe("updateAuction mutation", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
      },
    };
  });

  it("should update the auction successfully if the user is the seller and auction is draft", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>
    );
    vi.mocked(auth.resolveUserId).mockReturnValue("user_123");
    vi.mocked(auth.getCallerRole).mockResolvedValue("seller");

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
  });

  it("should throw an error if the user is not authenticated", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue(null);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      updates: { title: "New Title" },
    };

    await expect(
      updateAuctionHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("Not authenticated");
  });

  it("should throw an error if the user is not the seller", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>
    );
    vi.mocked(auth.resolveUserId).mockReturnValue("user_other");
    vi.mocked(auth.getCallerRole).mockResolvedValue("seller");

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
    ).rejects.toThrow("Not authorized: You can only edit your own auctions");
  });

  it("should throw an error if the auction is not in draft or pending_review", async () => {
    vi.mocked(auth.getAuthUser).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof auth.getAuthUser>>
    );
    vi.mocked(auth.resolveUserId).mockReturnValue("user_123");
    vi.mocked(auth.getCallerRole).mockResolvedValue("seller");

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
    ).rejects.toThrow(
      "You can only edit auctions in draft or pending_review status"
    );
  });
});
