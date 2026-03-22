import { describe, it, expect, vi, beforeEach } from "vitest";

import { deleteDraftHandler } from "./mutations/delete";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type MockCtxType = {
  db: {
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    system: unknown;
    normalizeId: ReturnType<typeof vi.fn>;
  };
  storage: {
    delete: ReturnType<typeof vi.fn>;
    getUrl: ReturnType<typeof vi.fn>;
    generateUploadUrl: ReturnType<typeof vi.fn>;
  };
  auth: unknown;
  scheduler: unknown;
  runMutation: unknown;
  runQuery: unknown;
  runAction: unknown;
};

vi.mock("../lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
  assertOwnership: vi.fn(),
  getAuthUser: vi.fn().mockResolvedValue({ id: "user123" }),
  resolveUserId: vi.fn((user) => user.id),
}));

describe("deleteDraft mutation", () => {
  let mockCtx: MockCtxType;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (auction: { [key: string]: unknown } | null) => {
    return {
      db: {
        get: vi.fn().mockResolvedValue(auction),
        delete: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        replace: vi.fn(),
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
        system: {},
        normalizeId: vi.fn((_table: string, id: string) => id),
      },
      storage: {
        delete: vi.fn(),
        getUrl: vi.fn(),
        generateUploadUrl: vi.fn(),
      },
      auth: {},
      scheduler: {},
      runMutation: {},
      runQuery: {},
      runAction: {},
    } as unknown as MockCtxType;
  };

  it("should delete a draft auction successfully", async () => {
    const userId = "user123";
    const auctionId = "auction123" as unknown as Id<"auctions">;
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

    const result = await deleteDraftHandler(mockCtx as unknown as MutationCtx, {
      auctionId,
    });

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
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");

    await expect(
      deleteDraftHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "nonexistent" as unknown as Id<"auctions">,
      })
    ).rejects.toThrow("Auction not found");
  });

  it("should fail if not in draft status", async () => {
    const mockAuction = {
      _id: "a1",
      sellerId: "u1",
      status: "active",
    };

    mockCtx = setupMockCtx(mockAuction);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");

    await expect(
      deleteDraftHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as unknown as Id<"auctions">,
      })
    ).rejects.toThrow("Only draft auctions can be deleted");
  });
});
