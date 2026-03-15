import { describe, it, expect, vi, beforeEach } from "vitest";

import { bulkUpdateAuctionsHandler } from "./mutations";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

type MockCtx = {
  db: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    system: unknown;
    normalizeId: ReturnType<typeof vi.fn>;
  };
  storage: unknown;
  auth: unknown;
  scheduler: unknown;
  runMutation: unknown;
  runQuery: unknown;
  runAction: unknown;
};

describe("bulkUpdateAuctions mutation", () => {
  let mockCtx: MockCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    return {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        replace: vi.fn(),
        delete: vi.fn(),
        query: vi.fn(),
        system: {},
        normalizeId: vi.fn((_table: string, id: string) => id),
      },
    } as unknown as MockCtx;
  };

  it("should update multiple auctions successfully", async () => {
    const id1 = "a1" as Id<"auctions">;
    const id2 = "a2" as Id<"auctions">;

    const auction1 = { _id: id1, status: "pending_review" };
    const auction2 = { _id: id2, status: "pending_review" };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockImplementation(async (id: Id<"auctions">) => {
      if (id === id1) return auction1;
      if (id === id2) return auction2;
      return null;
    });

    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "admin",
      userId: "admin",
    });

    const result = await bulkUpdateAuctionsHandler(
      mockCtx as unknown as MutationCtx,
      {
        auctionIds: [id1, id2],
        updates: { status: "active", endTime: Date.now() + 10000 },
      }
    );

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
      mockCtx as unknown as MutationCtx,
      "auctions",
      "pending",
      -1
    );
    expect(adminUtils.updateCounter).toHaveBeenCalledWith(
      mockCtx as unknown as MutationCtx,
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
      bulkUpdateAuctionsHandler(mockCtx as unknown as MutationCtx, {
        auctionIds: ["a1" as Id<"auctions">],
        updates: { status: "active" },
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("should throw error if bulk update size limit exceeded", async () => {
    mockCtx = setupMockCtx();
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "admin",
      userId: "admin",
    });

    const manyIds = Array(51).fill("a1");

    await expect(
      bulkUpdateAuctionsHandler(mockCtx as unknown as MutationCtx, {
        auctionIds: manyIds as Id<"auctions">[],
        updates: { status: "active" },
      })
    ).rejects.toThrow(/exceeds limit/);
  });
});
