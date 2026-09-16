import { describe, it, expect, vi, beforeEach } from "vitest";

import { adminUpdateLotHandler } from "./mutations/update";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  getAuthUser: vi.fn().mockResolvedValue({ id: "admin123" }),
  resolveUserId: vi.fn((user: { id: string }) => user.id),
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

interface MockCtxType {
  db: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
}

describe("adminUpdateLot mutation", () => {
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

  it("should update a lot as admin", async () => {
    const lotId = "auction123" as Id<"lots">;
    const mockAuction = {
      _id: lotId,
      status: "pending_review",
      title: "Test Auction",
      endTime: Date.now() + 86400000,
    };

    mockCtx.db.get.mockResolvedValue(mockAuction);

    const result = await adminUpdateLotHandler(
      mockCtx as unknown as MutationCtx,
      {
        lotId,
        updates: { status: "approved" },
      }
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith(
      "lots",
      lotId,
      expect.objectContaining({ status: "approved" })
    );
  });

  it("should throw error if lot not found", async () => {
    const lotId = "invalid" as Id<"lots">;
    mockCtx.db.get.mockResolvedValue(null);

    await expect(
      adminUpdateLotHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        updates: { status: "approved" },
      })
    ).rejects.toThrow("Lot not found");
  });
});
