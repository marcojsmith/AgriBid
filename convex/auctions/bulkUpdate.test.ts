/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { bulkUpdateAuctionsHandler } from "./mutations";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

describe("bulkUpdateAuctions mutation", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    const mockDb = {
      get: vi.fn(),
      patch: vi.fn(),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
  };

  it("should update multiple auctions successfully", async () => {
    const id1 = "a1" as Id<"auctions">;
    const id2 = "a2" as Id<"auctions">;

    const auction1 = { _id: id1, status: "pending_review" };
    const auction2 = { _id: id2, status: "pending_review" };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockImplementation(async (id: any) => {
      if (id === id1) return auction1;
      if (id === id2) return auction2;
      return null;
    });

    vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);

    const result = await bulkUpdateAuctionsHandler(mockCtx, {
      auctionIds: [id1, id2],
      updates: { status: "active", endTime: Date.now() + 10000 },
    });

    expect(result.success).toBe(true);
    expect(result.updated).toContain(id1);
    expect(result.updated).toContain(id2);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      id1,
      expect.objectContaining({ status: "active" })
    );
    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      id2,
      expect.objectContaining({ status: "active" })
    );

    // Status counters should be adjusted for both
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(
      mockCtx,
      "auctions",
      "pending",
      -1
    );
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(
      mockCtx,
      "auctions",
      "active",
      1
    );
    expect(adminUtils.updateCounter).toHaveBeenCalledTimes(4); // 2 per auction
  });

  it("should fail if not an admin", async () => {
    mockCtx = setupMockCtx();
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error("Unauthorized"));

    await expect(
      bulkUpdateAuctionsHandler(mockCtx, {
        auctionIds: ["a1" as any],
        updates: { status: "active" },
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("should throw error if bulk update size limit exceeded", async () => {
    mockCtx = setupMockCtx();
    vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);

    const manyIds = Array(51).fill("a1");

    await expect(
      bulkUpdateAuctionsHandler(mockCtx, {
        auctionIds: manyIds,
        updates: { status: "active" },
      })
    ).rejects.toThrow(/exceeds limit/);
  });
});
