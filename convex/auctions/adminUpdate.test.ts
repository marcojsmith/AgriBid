import { describe, it, expect, vi, beforeEach } from "vitest";

import { adminUpdateAuctionHandler } from "./mutations";
import * as auth from "../lib/auth";
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
  adjustStatusCounters: vi.fn(),
}));

describe("adminUpdateAuction mutation", () => {
  let mockCtx: any;

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

  it("should allow an admin to update an auction", async () => {
    const auctionId = "a1" as Id<"auctions">;
    const mockAuction = {
      _id: auctionId,
      status: "pending_review",
      title: "Old Title",
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);
    vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "admin" } as any);

    const result = await adminUpdateAuctionHandler(mockCtx, {
      auctionId,
      updates: {
        title: "New Title",
        status: "active",
        endTime: Date.now() + 10000,
      },
    });

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      auctionId,
      expect.objectContaining({
        title: "New Title",
        status: "active",
        hiddenByFlags: false,
      })
    );
  });

  it("should fail if auction not found", async () => {
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "admin" } as any);

    await expect(
      adminUpdateAuctionHandler(mockCtx, {
        auctionId: "none" as any,
        updates: { title: "New" },
      })
    ).rejects.toThrow("Auction not found");
  });
});
