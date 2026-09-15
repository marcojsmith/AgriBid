import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  calculateAndRecordFees,
  cleanupDraftsHandler,
  settleExpiredAuctionsHandler,
} from "./internal";
import type { MutationCtx } from "../_generated/server";

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

interface MockCtxType {
  db: {
    query: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
  storage: {
    delete: ReturnType<typeof vi.fn>;
  };
  auth: {
    getUserIdentity: ReturnType<typeof vi.fn>;
  };
}

interface IndexQuery {
  eq: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
}

interface QueryMock {
  withIndex: ReturnType<typeof vi.fn>;
  filter: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  unique: ReturnType<typeof vi.fn>;
}

const mockQuery = (): QueryMock => {
  const query: QueryMock = {
    withIndex: vi.fn((_index: string, cb?: (q: IndexQuery) => void) => {
      if (cb) {
        cb({
          eq: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
        });
      }
      return query;
    }),
    filter: vi.fn().mockReturnThis(),
    collect: vi.fn().mockResolvedValue([]),
    first: vi.fn().mockResolvedValue(null),
    unique: vi.fn().mockResolvedValue(null),
  };
  return query;
};

describe("Internal Logic Coverage", () => {
  let mockCtx: MockCtxType;

  /**
   * Builds a table-aware query mock so each `ctx.db.query(table)` call returns
   * sensible results for the table being read, independent of call order.
   */
  const setupTableQuery = (
    lots: Record<string, unknown>[] = [],
    bids: Record<string, unknown>[] = [],
    fees: Record<string, unknown>[] = [],
    existingFee: Record<string, unknown> | null = null
  ) => {
    mockCtx.db.query = vi.fn().mockImplementation((table: string) => {
      if (table === "lots") {
        return Object.assign(mockQuery(), {
          collect: vi.fn().mockResolvedValue(lots),
        });
      }
      if (table === "bids") {
        return Object.assign(mockQuery(), {
          collect: vi.fn().mockResolvedValue(bids),
        });
      }
      if (table === "platformFees") {
        return Object.assign(mockQuery(), {
          collect: vi.fn().mockResolvedValue(fees),
        });
      }
      if (table === "lotFees") {
        return Object.assign(mockQuery(), {
          first: vi.fn().mockResolvedValue(existingFee),
        });
      }
      return mockQuery();
    });
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        query: vi.fn(mockQuery),
        get: vi
          .fn()
          .mockResolvedValue({ status: "published", endTime: Date.now() - 1000 }),
        delete: vi.fn(),
        insert: vi.fn(),
        patch: vi.fn(),
      },
      storage: {
        delete: vi.fn(),
      },
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue(null),
      },
    };
  });

  describe("cleanupDraftsHandler errors", () => {
    it("should handle storage.delete failure", async () => {
      const mockDraft = {
        _id: "d1",
        status: "draft",
        conditionReportUrl: "s1",
        images: {},
      };
      const q = mockQuery();
      q.collect.mockResolvedValue([mockDraft]);
      mockCtx.db.query = vi.fn().mockReturnValue(q);
      mockCtx.storage.delete.mockRejectedValue(
        new Error("Storage delete failed")
      );
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {
        // intentional no-op: silences the expected storage-delete warning
      });

      await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete condition report"),
        expect.anything()
      );
      expect(mockCtx.db.delete).toHaveBeenCalledWith("lots", "d1");

      spy.mockRestore();
    });

    it("should handle db.delete failure", async () => {
      const mockDraft = {
        _id: "d1",
        status: "draft",
        images: {},
      };
      const q = mockQuery();
      q.collect.mockResolvedValue([mockDraft]);
      mockCtx.db.query = vi.fn().mockReturnValue(q);
      mockCtx.db.delete.mockRejectedValue(new Error("DB delete failed"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {
        // intentional no-op: silences the expected draft-delete error
      });

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx
      );

      expect(result.errors).toBe(1);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete draft lot"),
        expect.anything()
      );

      spy.mockRestore();
    });
  });

  describe("settleExpiredAuctionsHandler", () => {
    it("should settle expired lot as sold if reserve met and has bids", async () => {
      const mockLot = {
        _id: "a1",
        title: "Test",
        sellerId: "seller1",
        currentPrice: 1000,
        reservePrice: 500,
        status: "assigned",
        auctionId: "auction1",
      };
      const mockBid = {
        bidderId: "u1",
        amount: 1000,
        status: "valid",
        timestamp: 100,
      };

      setupTableQuery([mockLot], [mockBid]);

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          status: "sold",
          winnerId: "u1",
        })
      );
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "userActivity",
        expect.objectContaining({
          userId: "seller1",
          type: "listing_sold",
          description: expect.stringContaining("Listing sold for R") as string,
          relatedId: "a1",
        })
      );
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "userActivity",
        expect.objectContaining({
          userId: "u1",
          type: "bid_won",
          description: expect.stringContaining("Won auction for R") as string,
          relatedId: "a1",
        })
      );
    });

    it("should handle lower bid in tie-break reduce", async () => {
      const mockLot = {
        _id: "a1",
        title: "Test",
        currentPrice: 1000,
        reservePrice: 500,
        status: "assigned",
        auctionId: "auction1",
      };
      const highBid = {
        bidderId: "u1",
        amount: 1000,
        status: "valid",
        timestamp: 100,
      };
      const lowBid = {
        bidderId: "u2",
        amount: 500,
        status: "valid",
        timestamp: 200,
      };

      setupTableQuery([mockLot], [highBid, lowBid]);

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          status: "sold",
          winnerId: "u1",
        })
      );
    });

    it("should settle expired lot as unsold if reserve not met", async () => {
      const mockLot = {
        _id: "a1",
        title: "Test",
        currentPrice: 400,
        reservePrice: 500,
        status: "assigned",
        auctionId: "auction1",
      };
      const mockBid = {
        bidderId: "u1",
        amount: 400,
        status: "valid",
        timestamp: 100,
      };

      setupTableQuery([mockLot], [mockBid]);

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          status: "unsold",
          auctionId: undefined,
        })
      );
      expect(mockCtx.db.insert).not.toHaveBeenCalledWith(
        "userActivity",
        expect.anything()
      );
    });

    it("should skip voided bids when settling", async () => {
      const mockLot = {
        _id: "a1",
        title: "Test",
        currentPrice: 1000,
        reservePrice: 500,
        status: "assigned",
        auctionId: "auction1",
      };
      const mockBid = {
        bidderId: "u1",
        amount: 1000,
        status: "voided",
        timestamp: 100,
      };

      setupTableQuery([mockLot], [mockBid]);

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          status: "unsold",
          auctionId: undefined,
        })
      );
      expect(mockCtx.db.insert).not.toHaveBeenCalledWith(
        "userActivity",
        expect.anything()
      );
    });

    it("should settle lot as unsold when no bids exist", async () => {
      const mockLot = {
        _id: "a1",
        title: "Test Auction",
        currentPrice: 1000,
        reservePrice: 500,
        status: "assigned",
        auctionId: "auction1",
      };

      setupTableQuery([mockLot], []);

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          status: "unsold",
          winnerId: undefined,
          auctionId: undefined,
        })
      );
      expect(mockCtx.db.insert).not.toHaveBeenCalledWith(
        "userActivity",
        expect.anything()
      );
    });

    it("should handle tie-break - earlier timestamp wins", async () => {
      const mockLot = {
        _id: "a1",
        title: "Test",
        currentPrice: 1000,
        reservePrice: 500,
        status: "assigned",
        auctionId: "auction1",
      };
      const earlierBid = {
        bidderId: "u1",
        amount: 1000,
        status: "valid",
        timestamp: 100,
      };
      const laterBid = {
        bidderId: "u2",
        amount: 1000,
        status: "valid",
        timestamp: 200,
      };

      setupTableQuery([mockLot], [laterBid, earlierBid]);

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          status: "sold",
          winnerId: "u1",
        })
      );
    });
  });

  describe("cleanupDraftsHandler edge cases", () => {
    it("should handle no drafts to clean up", async () => {
      mockCtx.db.query = vi.fn().mockReturnValue(
        Object.assign(mockQuery(), {
          collect: vi.fn().mockResolvedValue([]),
        })
      );

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx
      );

      expect(result.deleted).toBe(0);
      expect(result.errors).toBe(0);
    });

    it("should attempt to delete draft images", async () => {
      const mockDraft = {
        _id: "d1",
        status: "draft",
        images: { main: "img1" },
        _creationTime: Date.now() - 40 * 24 * 60 * 60 * 1000,
      };
      mockCtx.db.query = vi.fn().mockReturnValue(
        Object.assign(mockQuery(), {
          collect: vi.fn().mockResolvedValue([mockDraft]),
        })
      );

      await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.delete).toHaveBeenCalledWith("lots", "d1");
    });
  });

  describe("calculateAndRecordFees idempotency", () => {
    it("should skip insert when lotFee record already exists", async () => {
      const mockLot = {
        _id: "a1",
        title: "Test",
        currentPrice: 1000,
        status: "sold",
      };
      const mockFee = {
        _id: "f1",
        name: "Seller Commission",
        feeType: "percentage",
        value: 0.05,
        appliesTo: "seller",
        isActive: true,
      };
      const existingLotFee = {
        _id: "af1",
        lotId: "a1",
        feeId: "f1",
        appliedTo: "seller",
      };

      setupTableQuery([], [], [mockFee], existingLotFee);

      await calculateAndRecordFees(
        mockCtx as unknown as MutationCtx,
        mockLot as never
      );

      expect(mockCtx.db.insert).not.toHaveBeenCalled();
    });

    it("should insert lotFee when no existing record found", async () => {
      const mockLot = {
        _id: "a1",
        title: "Test",
        currentPrice: 1000,
        status: "sold",
      };
      const mockFee = {
        _id: "f1",
        name: "Seller Commission",
        feeType: "percentage",
        value: 0.05,
        appliesTo: "seller",
        isActive: true,
      };

      setupTableQuery([], [], [mockFee], null);

      await calculateAndRecordFees(
        mockCtx as unknown as MutationCtx,
        mockLot as never
      );

      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "lotFees",
        expect.objectContaining({
          lotId: "a1",
          feeId: "f1",
          feeName: expect.any(String) as string,
          appliedTo: "seller",
          feeType: expect.any(String) as string,
          rate: expect.any(Number) as number,
          salePrice: expect.any(Number) as number,
          calculatedAmount: expect.any(Number) as number,
          createdAt: expect.any(Number) as number,
        })
      );
    });
  });
});
