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

type MockCtxType = {
  db: {
    query: ReturnType<typeof vi.fn>;
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
  runMutation: ReturnType<typeof vi.fn>;
};

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

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        query: vi.fn(mockQuery),
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
      runMutation: vi.fn().mockResolvedValue("mock-notification-id"),
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
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await cleanupDraftsHandler(mockCtx as unknown as MutationCtx);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete condition report"),
        expect.anything()
      );
      expect(mockCtx.db.delete).toHaveBeenCalledWith("d1");

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
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await cleanupDraftsHandler(
        mockCtx as unknown as MutationCtx
      );

      expect(result.errors).toBe(1);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete draft auction"),
        expect.anything()
      );

      spy.mockRestore();
    });
  });

  describe("settleExpiredAuctionsHandler", () => {
    it("should settle expired auction as sold if reserve met and has bids", async () => {
      const mockAuction = {
        _id: "a1",
        title: "Test",
        currentPrice: 1000,
        reservePrice: 500,
        status: "active",
      };
      const mockBid = {
        bidderId: "u1",
        amount: 1000,
        status: "valid",
        timestamp: 100,
      };

      mockCtx.db.query = vi
        .fn()
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockAuction]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockBid]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            first: vi.fn().mockResolvedValue(null),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            first: vi.fn().mockResolvedValue(null),
          })
        );

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "sold",
          winnerId: "u1",
        })
      );
    });

    it("should handle lower bid in tie-break reduce", async () => {
      const mockAuction = {
        _id: "a1",
        title: "Test",
        currentPrice: 1000,
        reservePrice: 500,
        status: "active",
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

      mockCtx.db.query = vi
        .fn()
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockAuction]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([highBid, lowBid]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            first: vi.fn().mockResolvedValue(null),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            first: vi.fn().mockResolvedValue(null),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            first: vi.fn().mockResolvedValue(null),
          })
        );

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "sold",
          winnerId: "u1",
        })
      );
    });

    it("should settle expired auction as unsold if reserve not met", async () => {
      const mockAuction = {
        _id: "a1",
        title: "Test",
        currentPrice: 400,
        reservePrice: 500,
        status: "active",
      };
      const mockBid = {
        bidderId: "u1",
        amount: 400,
        status: "valid",
        timestamp: 100,
      };

      mockCtx.db.query = vi
        .fn()
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockAuction]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockBid]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            unique: vi.fn().mockResolvedValue(null),
          })
        );

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "unsold",
        })
      );
    });

    it("should skip voided bids when settling", async () => {
      const mockAuction = {
        _id: "a1",
        title: "Test",
        currentPrice: 1000,
        reservePrice: 500,
        status: "active",
      };
      const mockBid = {
        bidderId: "u1",
        amount: 1000,
        status: "voided",
        timestamp: 100,
      };

      mockCtx.db.query = vi
        .fn()
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockAuction]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockBid]),
          })
        );

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "unsold",
        })
      );
    });

    it("should settle auction as unsold when no bids exist", async () => {
      const mockAuction = {
        _id: "a1",
        title: "Test Auction",
        currentPrice: 1000,
        reservePrice: 500,
        status: "active",
      };

      mockCtx.db.query = vi
        .fn()
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockAuction]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([]),
          })
        );

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "unsold",
          winnerId: undefined,
        })
      );
    });

    it("should handle tie-break - earlier timestamp wins", async () => {
      const mockAuction = {
        _id: "a1",
        title: "Test",
        currentPrice: 1000,
        reservePrice: 500,
        status: "active",
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

      mockCtx.db.query = vi
        .fn()
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockAuction]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([laterBid, earlierBid]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            first: vi.fn().mockResolvedValue(null),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            first: vi.fn().mockResolvedValue(null),
          })
        );

      await settleExpiredAuctionsHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
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

      expect(mockCtx.db.delete).toHaveBeenCalledWith("d1");
    });
  });

  describe("calculateAndRecordFees idempotency", () => {
    it("should skip insert when auctionFee record already exists", async () => {
      const mockAuction = {
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
      const existingAuctionFee = {
        _id: "af1",
        auctionId: "a1",
        feeId: "f1",
        appliedTo: "seller",
      };

      mockCtx.db.query = vi
        .fn()
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockFee]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            first: vi.fn().mockResolvedValue(existingAuctionFee),
          })
        );

      await calculateAndRecordFees(
        mockCtx as unknown as MutationCtx,
        mockAuction as never
      );

      expect(mockCtx.db.insert).not.toHaveBeenCalled();
    });

    it("should insert auctionFee when no existing record found", async () => {
      const mockAuction = {
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

      mockCtx.db.query = vi
        .fn()
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            collect: vi.fn().mockResolvedValue([mockFee]),
          })
        )
        .mockReturnValueOnce(
          Object.assign(mockQuery(), {
            first: vi.fn().mockResolvedValue(null),
          })
        );

      await calculateAndRecordFees(
        mockCtx as unknown as MutationCtx,
        mockAuction as never
      );

      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auctionFees",
        expect.objectContaining({
          auctionId: "a1",
          feeId: "f1",
          feeName: expect.any(String),
          appliedTo: "seller",
          feeType: expect.any(String),
          rate: expect.any(Number),
          salePrice: expect.any(Number),
          calculatedAmount: expect.any(Number),
          createdAt: expect.any(Number),
        })
      );
    });
  });
});
