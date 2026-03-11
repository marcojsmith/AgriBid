import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { deleteDraftHandler } from "./mutations";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
  assertOwnership: vi.fn(),
  getAuthUser: vi.fn().mockResolvedValue({ id: "user123" }),
  resolveUserId: vi.fn((user) => user.id),
}));

describe("deleteDraft mutation", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (auction: any) => {
    const mockDb = {
      get: vi.fn().mockResolvedValue(auction),
      delete: vi.fn(),
      patch: vi.fn(),
      insert: vi.fn(),
      query: vi.fn(() => ({
        withIndex: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        first: vi
          .fn()
          .mockResolvedValue({ _id: "counter_id", total: 1, draft: 1 }),
        unique: vi
          .fn()
          .mockResolvedValue({ _id: "counter_id", total: 1, draft: 1 }),
      })),
    };

    return {
      db: mockDb as any,
      storage: {
        delete: vi.fn(),
      },
    } as unknown as MutationCtx;
  };

  it("should delete a draft auction successfully", async () => {
    const userId = "user123" as any;
    const auctionId = "auction123" as Id<"auctions">;
    const mockAuction = {
      _id: auctionId,
      sellerId: userId,
      status: "draft",
      title: "Draft Tractor",
      images: { front: "img1", additional: ["img2"] },
      conditionReportUrl: "report1",
    };

    mockCtx = setupMockCtx(mockAuction);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);

    const result = await deleteDraftHandler(mockCtx, { auctionId });

    expect(result.success).toBe(true);
    expect(mockCtx.db.delete).toHaveBeenCalledWith(auctionId);

    // Check that counters were updated
    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "counter_id",
      expect.objectContaining({
        draft: 0,
      })
    );
    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "counter_id",
      expect.objectContaining({
        total: 0,
      })
    );
    // Should delete images
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("img1");
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("img2");
    expect(mockCtx.storage.delete).toHaveBeenCalledWith("report1");
  });

  it("should fail if auction not found", async () => {
    mockCtx = setupMockCtx(null);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123" as any);

    await expect(
      deleteDraftHandler(mockCtx, { auctionId: "nonexistent" as any })
    ).rejects.toThrow("Auction not found");
  });

  it("should fail if not in draft status", async () => {
    const mockAuction = {
      _id: "a1",
      sellerId: "u1",
      status: "active",
    };

    mockCtx = setupMockCtx(mockAuction);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1" as any);

    await expect(
      deleteDraftHandler(mockCtx, { auctionId: "a1" as any })
    ).rejects.toThrow("Only draft auctions can be deleted");
  });
});
