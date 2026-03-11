/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { deleteConditionReportHandler } from "./mutations";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
}));

describe("deleteConditionReport mutation", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    const mockDb = {
      get: vi.fn(),
      patch: vi.fn(),
    };
    const mockStorage = {
      delete: vi.fn(),
    };
    return {
      db: mockDb as any,
      storage: mockStorage as any,
    } as unknown as MutationCtx;
  };

  it("should allow owner to delete condition report", async () => {
    const auctionId = "a1" as Id<"auctions">;
    const userId = "user1";
    const storageId = "s1" as Id<"_storage">;

    const auctionDoc = {
      _id: auctionId,
      sellerId: userId,
      status: "draft",
      conditionReportUrl: storageId,
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);

    const result = await deleteConditionReportHandler(mockCtx, { auctionId });

    expect(result.success).toBe(true);
    expect(mockCtx.storage.delete).toHaveBeenCalledWith(storageId);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(auctionId, {
      conditionReportUrl: undefined,
    });
  });

  it("should fail if not authorized (not owner)", async () => {
    const auctionId = "a1" as Id<"auctions">;
    const sellerId = "owner";
    const reporterId = "not_owner";

    const auctionDoc = {
      _id: auctionId,
      sellerId,
      status: "draft",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(reporterId);

    await expect(
      deleteConditionReportHandler(mockCtx, { auctionId })
    ).rejects.toThrow("You can only modify your own auctions");
  });

  it("should fail if auction not found", async () => {
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user1");

    await expect(
      deleteConditionReportHandler(mockCtx, { auctionId: "a1" as any })
    ).rejects.toThrow(ConvexError);
  });
});
