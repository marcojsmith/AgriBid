import { describe, it, expect, vi, beforeEach } from "vitest";

import { updateConditionReportHandler } from "./mutations";
import * as auth from "../lib/auth";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

describe("updateConditionReportHandler", () => {
  const mockCtx = {
    db: {
      get: vi.fn(),
      patch: vi.fn(),
    },
    storage: {
      delete: vi.fn(),
    },
  };

  const mockAuction = {
    _id: "auction_123" as Id<"auctions">,
    sellerId: "user_123",
    status: "draft",
    conditionReportUrl: "old_storage_id" as Id<"_storage">,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auth, "getAuthenticatedUserId").mockResolvedValue("user_123");
  });

  it("should successfully update condition report and delete old one", async () => {
    mockCtx.db.get.mockResolvedValue(mockAuction);
    mockCtx.storage.delete.mockResolvedValue(undefined);
    mockCtx.db.patch.mockResolvedValue(undefined);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      storageId: "new_storage_id" as Id<"_storage">,
    };

    const result = await updateConditionReportHandler(
      mockCtx as unknown as MutationCtx,
      args
    );

    expect(result).toEqual({ success: true });
    expect(mockCtx.db.get).toHaveBeenCalledWith("auction_123");
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("old_storage_id");
    expect(mockCtx.db.patch).toHaveBeenCalledWith("auction_123", {
      conditionReportUrl: "new_storage_id",
    });
  });

  it("should handle cases where there is no old condition report", async () => {
    const auctionNoReport = { ...mockAuction, conditionReportUrl: undefined };
    mockCtx.db.get.mockResolvedValue(auctionNoReport);
    mockCtx.db.patch.mockResolvedValue(undefined);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      storageId: "new_storage_id" as Id<"_storage">,
    };

    await updateConditionReportHandler(mockCtx as unknown as MutationCtx, args);

    expect(mockCtx.storage.delete).not.toHaveBeenCalled();
    expect(mockCtx.db.patch).toHaveBeenCalledWith("auction_123", {
      conditionReportUrl: "new_storage_id",
    });
  });

  it("should throw 'Auction not found' when db.get returns null", async () => {
    mockCtx.db.get.mockResolvedValue(null);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      storageId: "new_storage_id" as Id<"_storage">,
    };

    await expect(
      updateConditionReportHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("Auction not found");
  });

  it("should throw if user does not own the auction", async () => {
    const auctionOtherOwner = { ...mockAuction, sellerId: "other_user" };
    mockCtx.db.get.mockResolvedValue(auctionOtherOwner);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      storageId: "new_storage_id" as Id<"_storage">,
    };

    await expect(
      updateConditionReportHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("You can only modify your own auctions");
  });
});
