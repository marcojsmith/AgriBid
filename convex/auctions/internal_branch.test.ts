import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { settleExpiredAuctionsHandler, cleanupDraftsHandler } from "./internal";

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("../lib/storage", () => ({
  deleteAuctionImages: vi.fn(),
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
    runMutation: ReturnType<typeof vi.fn>;
    runQuery: ReturnType<typeof vi.fn>;
    runAction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          filter: vi.fn((cb) => {
            cb({
              lte: vi.fn(),
              field: vi.fn(),
            });
            return {
              collect: vi.fn().mockResolvedValue([]),
            };
          }),
          collect: vi.fn().mockResolvedValue([]),
          unique: vi.fn().mockResolvedValue(null),
          first: vi.fn().mockResolvedValue(null),
          order: vi.fn().mockReturnThis(),
        })),
        patch: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
        insert: vi.fn(),
      },
      storage: {
        delete: vi.fn(),
      },
      runMutation: vi.fn().mockResolvedValue(undefined),
      runQuery: vi.fn().mockResolvedValue(undefined),
      runAction: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe("settleExpiredAuctionsHandler", () => {
    it("covers filter callback branch", async () => {
      // The previous mock already calls the filter callback
      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.db.query).toHaveBeenCalledWith("auctions");
    });
  });

  describe("settleExpiredAuctionsHandler reduce branches", () => {
    it("handles amount equal and timestamp higher in reduce", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        status: "active",
        reservePrice: 100,
        currentPrice: 200,
        endTime: 100,
        title: "Test",
      };
      const bids = [
        { bidderId: "u1", amount: 200, timestamp: 100, status: "valid" },
        { bidderId: "u2", amount: 200, timestamp: 200, status: "valid" },
      ];

      mockCtx.db.query
        .mockReturnValueOnce({
          withIndex: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue([auction]),
          unique: vi.fn().mockResolvedValue(null),
          first: vi.fn().mockResolvedValue(null),
          order: vi.fn().mockReturnThis(),
        })
        .mockReturnValueOnce({
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue(bids),
          unique: vi.fn().mockResolvedValue(null),
          first: vi.fn().mockResolvedValue(null),
          order: vi.fn().mockReturnThis(),
        });

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          winnerId: "u1", // earliest wins
        })
      );
    });

    it("handles amount lower in reduce", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        status: "active",
        reservePrice: 100,
        currentPrice: 200,
        endTime: 100,
        title: "Test",
      };
      const bids = [
        { bidderId: "u1", amount: 200, timestamp: 100, status: "valid" },
        { bidderId: "u2", amount: 150, timestamp: 200, status: "valid" },
      ];

      mockCtx.db.query
        .mockReturnValueOnce({
          withIndex: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue([auction]),
          unique: vi.fn().mockResolvedValue(null),
          first: vi.fn().mockResolvedValue(null),
          order: vi.fn().mockReturnThis(),
        })
        .mockReturnValueOnce({
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue(bids),
          unique: vi.fn().mockResolvedValue(null),
          first: vi.fn().mockResolvedValue(null),
          order: vi.fn().mockReturnThis(),
        });

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          winnerId: "u1",
        })
      );
    });

    it("handles amount higher in reduce", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        status: "active",
        reservePrice: 100,
        currentPrice: 200,
        endTime: 100,
        title: "Test",
      };
      const bids = [
        { bidderId: "u1", amount: 150, timestamp: 100, status: "valid" },
        { bidderId: "u2", amount: 200, timestamp: 200, status: "valid" },
      ];

      mockCtx.db.query
        .mockReturnValueOnce({
          withIndex: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue([auction]),
          unique: vi.fn().mockResolvedValue(null),
          first: vi.fn().mockResolvedValue(null),
          order: vi.fn().mockReturnThis(),
        })
        .mockReturnValueOnce({
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue(bids),
          unique: vi.fn().mockResolvedValue(null),
          first: vi.fn().mockResolvedValue(null),
          order: vi.fn().mockReturnThis(),
        });

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          winnerId: "u2",
        })
      );
    });
  });

  describe("cleanupDraftsHandler branches", () => {
    it("handles explicit system false", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        images: {},
      };
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([auction]),
        unique: vi.fn().mockResolvedValue(null),
        first: vi.fn().mockResolvedValue(null),
        order: vi.fn().mockReturnThis(),
      });

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx,
        { system: false }
      );
      expect(result.deleted).toBe(1);
    });

    it("handles explicit system true", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        images: {},
      };
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([auction]),
        unique: vi.fn().mockResolvedValue(null),
        first: vi.fn().mockResolvedValue(null),
        order: vi.fn().mockReturnThis(),
      });

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx,
        { system: true }
      );
      expect(result.deleted).toBe(1);
    });

    it("handles default system value", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        images: {},
      };
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([auction]),
        unique: vi.fn().mockResolvedValue(null),
        first: vi.fn().mockResolvedValue(null),
        order: vi.fn().mockReturnThis(),
      });

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(result.deleted).toBe(1);
    });

    it("handles auction with conditionReportUrl", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        images: {},
        conditionReportUrl: "storage1",
      };

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([auction]),
        unique: vi.fn().mockResolvedValue(null),
        first: vi.fn().mockResolvedValue(null),
        order: vi.fn().mockReturnThis(),
      });

      await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("storage1");
    });

    it("handles storage delete failure", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        images: {},
        conditionReportUrl: "storage1",
      };

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([auction]),
        unique: vi.fn().mockResolvedValue(null),
        first: vi.fn().mockResolvedValue(null),
        order: vi.fn().mockReturnThis(),
      });

      mockCtx.storage.delete.mockRejectedValue(new Error("Storage fail"));
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(result.deleted).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("handles general delete failure", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        images: {},
      };

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([auction]),
        unique: vi.fn().mockResolvedValue(null),
        first: vi.fn().mockResolvedValue(null),
        order: vi.fn().mockReturnThis(),
      });

      mockCtx.db.delete.mockRejectedValue(new Error("DB fail"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(result.errors).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
