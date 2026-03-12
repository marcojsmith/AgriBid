import { describe, it, expect, vi, beforeEach } from "vitest";
import { v } from "convex/values";

import * as auth from "../lib/auth";
import {
  getActiveAuctionsHandler,
  getAuctionBidsHandler,
  getMyBidsHandler,
  getMyBids,
  getAuctionById,
  getActiveAuctions,
  getAuctionFlagsHandler,
  getMyListingsStatsHandler,
} from "./queries";
import { authComponent } from "../auth";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// Mocking necessary modules
vi.mock("../_generated/server", () => ({
  query: vi.fn((q) => q),
  mutation: vi.fn((m) => m),
}));

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
  requireAdmin: vi.fn(),
  getAuthenticatedProfile: vi.fn(),
}));

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

vi.mock("./helpers", () => {
  return {
    toAuctionSummary: vi.fn((_ctx, a: { _id: string; title: string; endTime?: number; status: string }) =>
      Promise.resolve({
        _id: a._id,
        title: a.title,
        endTime: a.endTime,
        status: a.status,
      })
    ),
    toAuctionDetail: vi.fn((_ctx, a: { _id: string; title: string }) =>
      Promise.resolve({ _id: a._id, title: a.title })
    ),
    AuctionSummaryValidator: v.object({
      _id: v.string(),
      title: v.string(),
      endTime: v.optional(v.number()),
      status: v.string(),
    }),
    AuctionDetailValidator: v.any(),
    BidValidator: v.any(),
  };
});

vi.mock("../admin_utils", () => ({
  countQuery: vi.fn().mockResolvedValue(0),
}));

vi.mock("../users", () => ({
  findUserById: vi.fn(),
}));

interface MockCtxType {
  db: {
    get: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
}

describe("Queries Advanced Coverage", () => {
  let mockCtx: MockCtxType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let queryMock: any;

  beforeEach(() => {
    vi.resetAllMocks();
    queryMock = {
      withIndex: vi.fn().mockReturnThis(),
      withSearchIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      take: vi.fn().mockResolvedValue([]),
      collect: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      unique: vi.fn().mockResolvedValue(null),
      paginate: vi
        .fn()
        .mockResolvedValue({ page: [], isDone: true, continueCursor: "" }),
    };
    mockCtx = {
      db: {
        get: vi.fn().mockResolvedValue(null),
        query: vi.fn(() => queryMock),
      },
    };
  });

  describe("calculateUserBidStats Internal Scenarios (via getMyBidsHandler)", () => {
    it("should handle winning, outbid, and deleted auctions in stats", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1" as Id<"profiles">,
        userId: "u1",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      const bids = [
        { auctionId: "a1", amount: 1000, bidderId: "u1", timestamp: 100 }, // Winning
        { auctionId: "a2", amount: 500, bidderId: "u1", timestamp: 100 },  // Outbid
        { auctionId: "a3", amount: 500, bidderId: "u1", timestamp: 100 },  // Deleted
      ];
      queryMock.collect.mockResolvedValue(bids);

      mockCtx.db.get.mockImplementation(async (id: string) => {
        if (id === "a1") return { _id: "a1", status: "active", currentPrice: 1000, winnerId: "u1" };
        if (id === "a2") return { _id: "a2", status: "active", currentPrice: 2000, winnerId: "u2" };
        if (id === "a3") return null; // Deleted
        return null;
      });

      const result = await getMyBidsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(2); // Only a1 and a2
      const a1 = result.page.find(p => p._id === "a1");
      const a2 = result.page.find(p => p._id === "a2");
      expect(a1?.isWinning).toBe(true);
      expect(a2?.isWinning).toBe(false);
      expect(a2?.isOutbid).toBe(true);
    });

    it("should handle sold and rejected statuses", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({ _id: "u1" } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      queryMock.collect.mockResolvedValue([{ auctionId: "a1", amount: 1000, bidderId: "u1", timestamp: 100 }]);
      
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "sold", winnerId: "u1" });
      let result = await getMyBidsHandler(mockCtx as unknown as QueryCtx, { paginationOpts: { numItems: 10, cursor: null } });
      expect(result.page[0].isWon).toBe(true);

      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "rejected", winnerId: "other" });
      result = await getMyBidsHandler(mockCtx as unknown as QueryCtx, { paginationOpts: { numItems: 10, cursor: null } });
      expect(result.page[0].isCancelled).toBe(true);
    });
  });

  describe("getActiveAuctionsHandler Index Logic", () => {
    it("should use simple search index when multiple statuses are present", async () => {
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        search: "tractor",
        statusFilter: "all"
      });
      expect(queryMock.withSearchIndex).toHaveBeenCalledWith("search_title_simple", expect.any(Function));
    });

    it("should fallback to filter for make when multiple statuses are present", async () => {
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        make: "JD",
        statusFilter: "all"
      });
      expect(queryMock.filter).toHaveBeenCalled();
    });

    it("should handle partial year filters", async () => {
      // minYear only
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minYear: 2000
      });
      expect(queryMock.withIndex).toHaveBeenCalledWith("by_status_year", expect.any(Function));
      queryMock.withIndex.mockClear();

      // maxYear only
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        maxYear: 2020
      });
      expect(queryMock.withIndex).toHaveBeenCalledWith("by_status_year", expect.any(Function));
    });
  });

  describe("getAuctionBidsHandler Reveal Logic", () => {
    it("should reveal names to admins", async () => {
      queryMock.paginate.mockResolvedValue({ page: [{ _id: "b1", bidderId: "user_valid_id", auctionId: "a1" }], isDone: true, continueCursor: "" });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "admin",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        profile: { role: "admin" } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        authUser: {} as any
      });
      const { findUserById } = await import("../users");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(findUserById).mockResolvedValue({ name: "Admin View" } as any);

      const result = await getAuctionBidsHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null }
      });
      expect(result.page[0].bidderName).toBe("Admin View");
    });

    it("should handle missing user document during reveal", async () => {
      queryMock.paginate.mockResolvedValue({ page: [{ _id: "b1", bidderId: "user_valid_id", auctionId: "a1" }], isDone: true, continueCursor: "" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({ userId: "admin", profile: { role: "admin" } as any, authUser: {} as any });
      const { findUserById } = await import("../users");
      vi.mocked(findUserById).mockResolvedValue(null);

      const result = await getAuctionBidsHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null }
      });
      expect(result.page[0].bidderName).toBe("Anonymous");
    });
  });

  describe("Exported Query Wrappers (Validators)", () => {
    it("getActiveAuctions should be defined with args and handler", () => {
      expect(getActiveAuctions.args).toBeDefined();
      expect(getActiveAuctions.handler).toBeDefined();
    });

    it("getAuctionById should have validator for auctionId", () => {
      expect(getAuctionById.args.auctionId).toBeDefined();
    });

    it("getMyBids should have pagination and sort validators", () => {
      expect(getMyBids.args.paginationOpts).toBeDefined();
      expect(getMyBids.args.sort).toBeDefined();
    });
  });

  describe("getAuctionFlagsHandler", () => {
    it("should resolve reporter names", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      queryMock.collect.mockResolvedValue([
        { _id: "f1", reporterId: "r1", auctionId: "a1", reason: "suspicious", status: "pending", createdAt: 100 }
      ]);
      const { findUserById } = await import("../users");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(findUserById).mockResolvedValue({ name: "Reporter X" } as any);

      const result = await getAuctionFlagsHandler(mockCtx as unknown as QueryCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result[0].reporterName).toBe("Reporter X");
    });
  });

  describe("Remaining Handlers and Edge Cases", () => {
    it("getActiveAuctionsHandler should handle active statusFilter default and invalid parseFiniteInt", async () => {
      // No statusFilter provided -> defaults to active
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(queryMock.withIndex).toHaveBeenCalledWith("by_status", expect.any(Function));

      // Test parseFiniteInt with undefined and invalid values (simulated via getActiveAuctionsHandler args)
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minYear: NaN, // Should be treated as undefined in parseFiniteInt logic if val is not null but parsed is NaN
      });
    });

    it("getAuctionBidsHandler should handle short bidderIds", async () => {
      queryMock.paginate.mockResolvedValue({ page: [{ _id: "b1", bidderId: "short", auctionId: "a1" }], isDone: true, continueCursor: "" });
      const result = await getAuctionBidsHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null }
      });
      expect(result.page[0].bidderName).toBe("Anonymous");
    });

    it("getMyListingsStatsHandler should return zeroed stats if unauthenticated", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(null);
      const result = await getMyListingsStatsHandler(mockCtx as unknown as QueryCtx);
      expect(result.all).toBe(0);
    });

    it("getMyBidsHandler should return empty if unauthenticated", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue(null);
      const result = await getMyBidsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null }
      });
      expect(result.page).toHaveLength(0);
    });
  });
});
