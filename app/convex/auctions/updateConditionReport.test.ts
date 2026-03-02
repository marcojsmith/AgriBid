import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateConditionReportHandler } from "./mutations";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));

describe("updateConditionReport mutation", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
    };
    storage: {
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
      },
      storage: {
        delete: vi.fn(),
      },
    };
  });

  it("should successfully update condition report and delete old one if it exists", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_123");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
      conditionReportUrl: "old_storage_id",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      storageId: "new_storage_id",
    };

    const result = await updateConditionReportHandler(
      mockCtx as unknown as MutationCtx,
      args
    );

    expect(result.success).toBe(true);
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("old_storage_id");
    expect(mockCtx.db.patch).toHaveBeenCalledWith("auction_123", {
      conditionReportUrl: "new_storage_id",
    });
  });

  it("should throw an error if the user is not authenticated", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockRejectedValue(
      new Error("Not authenticated")
    );

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      storageId: "new_storage_id",
    };

    await expect(
      updateConditionReportHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("Not authenticated");
  });

  it("should throw an error if the user is not the owner", async () => {
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_other");

    const mockAuction = {
      _id: "auction_123",
      sellerId: "user_123",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const args = {
      auctionId: "auction_123" as Id<"auctions">,
      storageId: "new_storage_id",
    };

    await expect(
      updateConditionReportHandler(mockCtx as unknown as MutationCtx, args)
    ).rejects.toThrow("You can only modify your own auctions");
  });
});
