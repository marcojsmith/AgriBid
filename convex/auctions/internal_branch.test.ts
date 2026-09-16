import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { settleExpiredLotsHandler, cleanupDraftsHandler } from "./internal";

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("../lib/storage", () => ({
  deleteAuctionImages: vi.fn(),
  safeDelete: vi.fn(
    async (
      ctx: { storage: { delete: (id: string) => Promise<void> } },
      storageId: string,
      label: string
    ) => {
      try {
        await ctx.storage.delete(storageId);
      } catch (e) {
        console.warn(`Failed to delete ${label}: ${storageId}`, e);
      }
    }
  ),
}));

describe("Internal Mutations Branch Coverage", () => {
  let mockCtx: {
    db: {
      query: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
    };
    storage: {
      delete: ReturnType<typeof vi.fn>;
    };
  };

  /**
   * Builds a table-aware query mock. `lots`/`bids` return the supplied rows,
   * every other table returns an empty result set.
   *
   * @param lots - Rows returned for queries against the `lots` table.
   * @param bids - Rows returned for queries against the `bids` table.
   */
  const setupTableQuery = (
    lots: Record<string, unknown>[] = [],
    bids: Record<string, unknown>[] = []
  ) => {
    mockCtx.db.query = vi.fn().mockImplementation((table: string) => {
      if (table === "lots") {
        return {
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue(lots),
        };
      }
      if (table === "bids") {
        return {
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue(bids),
        };
      }
      return {
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([]),
      };
    });
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          filter: vi.fn((cb: (q: unknown) => void) => {
            cb({
              lte: vi.fn(),
              field: vi.fn(),
            });
            return {
              collect: vi.fn().mockResolvedValue([]),
            };
          }),
          collect: vi.fn().mockResolvedValue([]),
        })),
        patch: vi.fn(),
        delete: vi.fn(),
        get: vi.fn().mockResolvedValue({ status: "published", endTime: 100 }),
        insert: vi.fn(),
      },
      storage: {
        delete: vi.fn(),
      },
    };
  });

  describe("settleExpiredLotsHandler", () => {
    it("queries assigned lots by status", async () => {
      await settleExpiredLotsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.db.query).toHaveBeenCalledWith("lots");
    });
  });

  describe("settleExpiredLotsHandler reduce branches", () => {
    it("handles amount equal and timestamp higher in reduce", async () => {
      const lot = {
        _id: "a1" as Id<"lots">,
        status: "assigned",
        reservePrice: 100,
        currentPrice: 200,
        auctionId: "auction1",
        title: "Test",
      };
      const bids = [
        { bidderId: "u1", amount: 200, timestamp: 100, status: "valid" },
        { bidderId: "u2", amount: 200, timestamp: 200, status: "valid" },
      ];

      setupTableQuery([lot], bids);

      await settleExpiredLotsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          winnerId: "u1", // earliest wins
        })
      );
    });

    it("handles amount lower in reduce", async () => {
      const lot = {
        _id: "a1" as Id<"lots">,
        status: "assigned",
        reservePrice: 100,
        currentPrice: 200,
        auctionId: "auction1",
        title: "Test",
      };
      const bids = [
        { bidderId: "u1", amount: 200, timestamp: 100, status: "valid" },
        { bidderId: "u2", amount: 150, timestamp: 200, status: "valid" },
      ];

      setupTableQuery([lot], bids);

      await settleExpiredLotsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          winnerId: "u1",
        })
      );
    });

    it("handles amount higher in reduce", async () => {
      const lot = {
        _id: "a1" as Id<"lots">,
        status: "assigned",
        reservePrice: 100,
        currentPrice: 200,
        auctionId: "auction1",
        title: "Test",
      };
      const bids = [
        { bidderId: "u1", amount: 150, timestamp: 100, status: "valid" },
        { bidderId: "u2", amount: 200, timestamp: 200, status: "valid" },
      ];

      setupTableQuery([lot], bids);

      await settleExpiredLotsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          winnerId: "u2",
        })
      );
    });
  });

  describe("cleanupDraftsHandler branches", () => {
    it("handles explicit system false", async () => {
      const lot = {
        _id: "a1" as Id<"lots">,
        images: {},
      };
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([lot]),
      });

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx,
        { system: false }
      );
      expect(result.deleted).toBe(1);
    });

    it("handles explicit system true", async () => {
      const lot = {
        _id: "a1" as Id<"lots">,
        images: {},
      };
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([lot]),
      });

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx,
        { system: true }
      );
      expect(result.deleted).toBe(1);
    });

    it("handles default system value", async () => {
      const lot = {
        _id: "a1" as Id<"lots">,
        images: {},
      };
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([lot]),
      });

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(result.deleted).toBe(1);
    });

    it("handles lot with conditionReportUrl", async () => {
      const lot = {
        _id: "a1" as Id<"lots">,
        images: {},
        conditionReportUrl: "storage1",
      };

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([lot]),
      });

      await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("storage1");
    });

    it("handles storage delete failure", async () => {
      const lot = {
        _id: "a1" as Id<"lots">,
        images: {},
        conditionReportUrl: "storage1",
      };

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([lot]),
      });

      mockCtx.storage.delete.mockRejectedValue(new Error("Storage fail"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        // intentional no-op: silences the expected storage-delete warning
      });

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(result.deleted).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("handles general delete failure", async () => {
      const lot = {
        _id: "a1" as Id<"lots">,
        images: {},
      };

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([lot]),
      });

      mockCtx.db.delete.mockRejectedValue(new Error("DB fail"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // intentional no-op: silences the expected draft-delete error
      });

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(result.errors).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
