/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { v } from "convex/values";

import * as auth from "../lib/auth";
import {
  getActiveAuctionsHandler,
  getAuctionBidsHandler,
  getMyBidsHandler,
  getAuctionFlagsHandler,
  getMyListingsStatsHandler,
  getSellerInfoHandler,
  getAllPendingFlagsHandler,
  getAuctionByIdHandler,
  getMyListingsHandler,
  getMyListingsCountHandler,
  getMyBidsCountHandler,
  getMyBidsStatsHandler,
  getActiveMakesHandler,
  getPendingAuctionsHandler,
  getAllAuctionsHandler,
  getAuctionBidCountHandler,
  getEquipmentMetadataHandler,
  getCategoriesHandler,
  getSellerListingsHandler,
} from "./queries";
import { authComponent } from "../auth";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { findUserById } from "../users";
import { countQuery } from "../admin_utils";

// Helper types for mocked objects
type MockQuery = {
  withIndex: Mock;
  withSearchIndex: Mock;
  filter: Mock;
  order: Mock;
  take: Mock;
  collect: Mock;
  count: Mock;
  unique: Mock;
  paginate: Mock;
  [Symbol.asyncIterator]: Mock;
};

type MockQ = {
  eq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
};

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
    toAuctionSummary: vi.fn(
      (
        _ctx,
        a: { _id: string; title: string; endTime?: number; status: string }
      ) =>
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
  countQuery: vi.fn(),
}));

vi.mock("../users", () => ({
  findUserById: vi.fn(),
}));

describe("Queries Consolidated", () => {
  let mockCtx: QueryCtx;
  let queryMock: MockQuery;
  let qMock: MockQ;

  beforeEach(() => {
    vi.resetAllMocks();

    qMock = {
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      search: vi.fn().mockReturnThis(),
    };

    queryMock = {
      withIndex: vi.fn((_index, cb) => {
        if (cb) cb(qMock);
        return queryMock;
      }),
      withSearchIndex: vi.fn((_index, cb) => {
        if (cb) cb(qMock);
        return queryMock;
      }),
      filter: vi.fn((cb) => {
        const fMock = {
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          and: vi.fn().mockReturnThis(),
          field: vi.fn().mockReturnThis(),
        };
        if (cb) cb(fMock);
        return queryMock;
      }),
      order: vi.fn().mockReturnThis(),
      take: vi.fn().mockResolvedValue([]),
      collect: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      unique: vi.fn().mockReturnThis(),
      paginate: vi
        .fn()
        .mockResolvedValue({ page: [], isDone: true, continueCursor: "" }),
      [Symbol.asyncIterator]: vi.fn(() => {
        let index = 0;
        let items: unknown[] = [];
        let initialized = false;
        return {
          next: async () => {
            if (!initialized) {
              const collectFn = queryMock.collect as unknown;
              items = await (collectFn as () => Promise<unknown[]>)();
              initialized = true;
            }
            if (index < items.length) {
              return { value: items[index++], done: false };
            }
            return { value: undefined, done: true };
          },
        };
      }),
    };

    mockCtx = {
      db: {
        get: vi.fn().mockResolvedValue(null),
        query: vi.fn(() => queryMock),
      },
    } as unknown as QueryCtx;

    vi.mocked(countQuery).mockImplementation(async (q) => {
      const query = q as unknown as MockQuery;
      const countFn = query.count as unknown;
      if (typeof countFn === "function") {
        return (await (countFn as () => Promise<number>)()) as number;
      }
      const collectFn = query.collect as unknown;
      const results = await (collectFn as () => Promise<unknown[]>)();
      return results.length;
    });
  });

  describe("getMyBidsHandler", () => {
    it("should handle winning, outbid, and deleted auctions in stats", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        email: "test@example.com",
        _creationTime: 100,
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      const bids = [
        { auctionId: "a1", amount: 1000, bidderId: "u1", timestamp: 100 },
        { auctionId: "a2", amount: 500, bidderId: "u1", timestamp: 100 },
      ];
      queryMock.collect.mockResolvedValue(bids);

      vi.mocked(mockCtx.db.get).mockImplementation(async (id) => {
        const sid = id as string;
        if (sid === "a1")
          return {
            _id: "a1",
            status: "active",
            currentPrice: 1000,
            winnerId: "u1",
          } as Doc<"auctions">;
        if (sid === "a2")
          return {
            _id: "a2",
            status: "active",
            currentPrice: 2000,
            winnerId: "u2",
          } as Doc<"auctions">;
        return null;
      });

      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });

      expect(result.page).toHaveLength(2);
      const a1 = result.page.find((p) => p._id === "a1");
      const a2 = result.page.find((p) => p._id === "a2");
      expect(a1?.isWinning).toBe(true);
      expect(a2?.isWinning).toBe(false);
      expect(a2?.isOutbid).toBe(true);
    });

    it("should handle batching logic when user has > 100 auctions", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        name: "U1",
        _creationTime: 100,
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      const bids = Array.from({ length: 150 }, (_, i) => ({
        auctionId: `a${i}`,
        amount: 100,
        bidderId: "u1",
        timestamp: i,
      }));
      queryMock.collect.mockResolvedValue(bids);
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        status: "active",
      } as Doc<"auctions">);

      await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(mockCtx.db.get).toHaveBeenCalledTimes(150);
    });

    it("should handle sold and rejected statuses in bid stats", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        name: "U1",
        _creationTime: 100,
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      queryMock.collect.mockResolvedValue([
        { auctionId: "a1", amount: 1000, bidderId: "u1", timestamp: 100 },
      ]);

      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        status: "sold",
        winnerId: "u1",
      } as Doc<"auctions">);
      let result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].isWon).toBe(true);

      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        status: "rejected",
        winnerId: "other",
      } as Doc<"auctions">);
      result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].isCancelled).toBe(true);
    });

    it("should handle sorting and numeric cursor pagination", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        name: "U1",
        _creationTime: 100,
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      const bids = [
        { auctionId: "a1", amount: 1000, bidderId: "u1", timestamp: 100 },
        { auctionId: "a2", amount: 2000, bidderId: "u1", timestamp: 200 },
      ];
      queryMock.collect.mockResolvedValue(bids);

      vi.mocked(mockCtx.db.get).mockImplementation(async (id) => {
        if (id === "a1")
          return {
            _id: "a1",
            status: "active",
            endTime: 2000,
          } as Doc<"auctions">;
        if (id === "a2")
          return {
            _id: "a2",
            status: "active",
            endTime: 1000,
          } as Doc<"auctions">;
        return null;
      });

      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 1, cursor: null },
        sort: "ending",
      });
      expect(result.page[0]._id).toBe("a2");
      expect(result.continueCursor).toBe("1");
    });

    it("should skip null auctions in calculateUserBidStats via getMyBidsHandler", async () => {
      // Setup mock profile
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        userId: "u1",
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      queryMock.collect.mockResolvedValue([
        { auctionId: "missing", amount: 1000, bidderId: "u1", timestamp: 100 },
      ]);
      vi.mocked(mockCtx.db.get).mockResolvedValue(null);

      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(0);
    });
  });

  describe("getActiveAuctionsHandler", () => {
    it("should return paginated active auctions by default", async () => {
      const result = await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(0);
    });

    it("should handle search with multiple statuses", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        search: "tractor",
        statusFilter: "all",
      });
      expect(queryMock.withSearchIndex).toHaveBeenCalledWith(
        "search_title_simple",
        expect.any(Function)
      );
    });

    it("should handle search with exactly one status", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        search: "tractor",
        statusFilter: "active",
      });
      expect(qMock.search).toHaveBeenCalledWith("title", "tractor");
      expect(qMock.eq).toHaveBeenCalledWith("status", "active");
    });

    it("should handle make with multiple statuses", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        make: "JD",
        statusFilter: "all",
      });
      expect(queryMock.order).toHaveBeenCalledWith("desc");
      expect(queryMock.filter).toHaveBeenCalled();
    });

    it("should handle make with single status", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        make: "JD",
        statusFilter: "active",
      });
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_status_make",
        expect.any(Function)
      );
    });

    it("should handle mixed year filters with single status", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minYear: 2000,
        maxYear: 2020,
        statusFilter: "active",
      });
      expect(qMock.gte).toHaveBeenCalledWith("year", 2000);
      expect(qMock.lte).toHaveBeenCalledWith("year", 2020);
    });

    it("should handle partial year filters with single status", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minYear: 2000,
        statusFilter: "active",
      });
      expect(qMock.gte).toHaveBeenCalledWith("year", 2000);

      vi.clearAllMocks();
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        maxYear: 2020,
        statusFilter: "active",
      });
      expect(qMock.lte).toHaveBeenCalledWith("year", 2020);
    });

    it("should handle year filter callback default branch", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "active",
        minYear: undefined,
        maxYear: undefined,
      });
    });

    it("should handle year filters with multiple statuses", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minYear: 2000,
        statusFilter: "all",
      });
      expect(queryMock.order).toHaveBeenCalledWith("desc");
    });

    it("should handle price and hours filters in getFilteredQuery", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minPrice: 100,
        maxPrice: 1000,
        maxHours: 50,
      });
      expect(queryMock.filter).toHaveBeenCalled();
    });

    it("should handle SEARCH_COUNT_CAP logic", async () => {
      const mockItems = Array(1001).fill({
        _id: "a1",
        status: "active",
        title: "tractor",
      });
      queryMock.take.mockResolvedValue(mockItems);

      const result = await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        search: "tractor",
      });
      expect(result.totalCount).toBe("1000+");
    });

    it("should trigger matchesAuctionFilter for all filter types returning false", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [
          {
            _id: "a1",
            status: "active",
            make: "JD",
            year: 2000,
            currentPrice: 500,
            operatingHours: 100,
          },
        ],
        isDone: true,
        continueCursor: "",
      });
      queryMock.take.mockResolvedValue([
        {
          _id: "a1",
          status: "active",
          make: "JD",
          year: 2000,
          currentPrice: 500,
          operatingHours: 100,
        },
      ]);

      const cases = [
        { make: "CAT" },
        { minYear: 2010 },
        { maxYear: 1990 },
        { minPrice: 1000 },
        { maxPrice: 100 },
        { maxHours: 50 },
      ];

      for (const c of cases) {
        const result = await getActiveAuctionsHandler(mockCtx, {
          paginationOpts: { numItems: 10, cursor: null },
          search: "tractor",
          ...c,
        });
        expect(result.page).toHaveLength(0);
      }
    });
  });

  describe("getAuctionBidsHandler", () => {
    it("should reveal bidder name to admin", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "b1", bidderId: "u1234567890", auctionId: "a1" }],
        isDone: true,
        continueCursor: "",
      });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "admin",
        profile: {
          _id: "p1" as Id<"profiles">,
          _creationTime: 100,
          userId: "admin",
          role: "admin",
          isVerified: true,
          createdAt: 100,
          updatedAt: 100,
        } as Doc<"profiles">,
        authUser: { _id: "u1", name: "Admin", _creationTime: 100 } as any,
      });
      vi.mocked(findUserById).mockResolvedValue({
        _id: "p2" as Id<"profiles">,
        _creationTime: 100,
        userId: "u1234567890",
        name: "Real Name",
        role: "buyer",
        isVerified: true,
        createdAt: 100,
        updatedAt: 100,
      } as Doc<"profiles">);

      const result = await getAuctionBidsHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].bidderName).toBe("Real Name");
    });

    it("should reveal bidder name to seller", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "b1", bidderId: "u1234567890", auctionId: "a1" }],
        isDone: true,
        continueCursor: "",
      });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "seller",
        profile: {
          _id: "p1" as Id<"profiles">,
          _creationTime: 100,
          userId: "seller",
          role: "seller",
          isVerified: true,
          createdAt: 100,
          updatedAt: 100,
        } as Doc<"profiles">,
        authUser: { _id: "u1", name: "Seller", _creationTime: 100 } as any,
      });
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        sellerId: "seller",
      } as Doc<"auctions">);
      vi.mocked(findUserById).mockResolvedValue({
        _id: "p2" as Id<"profiles">,
        _creationTime: 100,
        userId: "u1234567890",
        name: "Real Name",
        role: "buyer",
        isVerified: true,
        createdAt: 100,
        updatedAt: 100,
      } as Doc<"profiles">);

      const result = await getAuctionBidsHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].bidderName).toBe("Real Name");
    });

    it("should mask name for non-admin/seller", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "b1", bidderId: "u1234567890", auctionId: "a1" }],
        isDone: true,
        continueCursor: "",
      });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "buyer",
        profile: {
          _id: "p1" as Id<"profiles">,
          _creationTime: 100,
          userId: "buyer",
          role: "buyer",
          isVerified: true,
          createdAt: 100,
          updatedAt: 100,
        } as Doc<"profiles">,
        authUser: { _id: "u1", name: "Buyer", _creationTime: 100 } as any,
      });
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        sellerId: "seller",
      } as Doc<"auctions">);

      const result = await getAuctionBidsHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].bidderName).toBe("Bidder");
    });

    it("should handle anonymous and short bidderIds", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [
          { _id: "b1", bidderId: null, auctionId: "a1" },
          { _id: "b2", bidderId: "short", auctionId: "a1" },
        ],
        isDone: true,
        continueCursor: "",
      });
      const result = await getAuctionBidsHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].bidderName).toBe("Anonymous");
      expect(result.page[1].bidderName).toBe("Anonymous");
    });
  });

  describe("Seller and Admin Operations", () => {
    beforeEach(() => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        name: "U1",
        _creationTime: 100,
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "u1",
        profile: {
          _id: "p1" as Id<"profiles">,
          _creationTime: 100,
          userId: "u1",
          role: "seller",
          isVerified: true,
          createdAt: 100,
          updatedAt: 100,
        } as Doc<"profiles">,
        authUser: { _id: "u1", name: "U1", _creationTime: 100 } as any,
      });
    });

    it("getSellerInfoHandler success", async () => {
      vi.mocked(findUserById).mockResolvedValue({
        _id: "p1" as Id<"profiles">,
        _creationTime: 100,
        userId: "u1",
        name: "Seller",
        role: "seller",
        isVerified: true,
        createdAt: 100,
        updatedAt: 100,
      } as Doc<"profiles">);
      vi.mocked(queryMock.unique).mockResolvedValue({
        _id: "p1" as Id<"profiles">,
        _creationTime: 100,
        userId: "u1",
        role: "seller",
        isVerified: true,
        createdAt: 100,
        updatedAt: 100,
      } as Doc<"profiles">);
      vi.mocked(countQuery).mockResolvedValue(5);

      const result = await getSellerInfoHandler(mockCtx, { sellerId: "u1" });
      expect(result?.name).toBe("Seller");
      expect(result?.itemsSold).toBe(5);
    });

    it("getMyListingsHandler success", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "a1", title: "My Listing" }],
        isDone: true,
        continueCursor: "",
      });
      const result = await getMyListingsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(1);
    });

    it("getSellerListingsHandler success", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "a1", status: "active" }],
        isDone: true,
        continueCursor: "",
      });
      const result = await getSellerListingsHandler(mockCtx, {
        userId: "u1",
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(1);
    });

    it("getMyListingsStatsHandler returns grouped stats", async () => {
      queryMock.collect.mockResolvedValue([
        { status: "active" },
        { status: "sold" },
        { status: "draft" },
        { status: "pending_review" },
        { status: "unsold" },
        { status: "rejected" },
      ]);
      const result = await getMyListingsStatsHandler(mockCtx);
      expect(result.active).toBe(1);
      expect(result.sold).toBe(1);
      expect(result.draft).toBe(1);
    });

    it("getAllAuctionsHandler success", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "u1",
        name: "Admin",
        _creationTime: 100,
      } as any);
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "a1", status: "active" }],
        isDone: true,
        continueCursor: "",
      });
      const result = await getAllAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(1);
    });

    it("getPendingAuctionsHandler success", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "u1",
        name: "Admin",
        _creationTime: 100,
      } as any);
      queryMock.collect.mockResolvedValue([{ _id: "a1", title: "P" }]);
      const result = await getPendingAuctionsHandler(mockCtx);
      expect(result).toHaveLength(1);
    });

    it("getAuctionFlagsHandler success", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "u1",
        name: "Admin",
        _creationTime: 100,
      } as any);
      queryMock.collect.mockResolvedValue([
        { _id: "f1", reporterId: "r1", status: "pending" },
      ]);
      vi.mocked(findUserById).mockResolvedValue({
        _id: "p1" as Id<"profiles">,
        _creationTime: 100,
        userId: "r1",
        name: "Reporter",
        role: "buyer",
        isVerified: true,
        createdAt: 100,
        updatedAt: 100,
      } as Doc<"profiles">);
      const result = await getAuctionFlagsHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toHaveLength(1);
      expect(result[0].reporterName).toBe("Reporter");
    });
  });

  describe("User Stats Handlers", () => {
    beforeEach(() => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        name: "U1",
        _creationTime: 100,
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
    });

    it("getMyBidsCountHandler returns numeric count", async () => {
      queryMock.collect.mockResolvedValue([{ auctionId: "a1" }]);
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        status: "active",
      } as Doc<"auctions">);
      const result = await getMyBidsCountHandler(mockCtx);
      expect(result).toBe(1);
    });

    it("getMyBidsStatsHandler returns active/winning totals", async () => {
      queryMock.collect.mockResolvedValue([{ auctionId: "a1", amount: 100 }]);
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        status: "active",
        currentPrice: 100,
        winnerId: "u1",
      } as Doc<"auctions">);
      const result = await getMyBidsStatsHandler(mockCtx);
      expect(result.totalActive).toBe(1);
      expect(result.winningCount).toBe(1);
    });

    it("getMyListingsCountHandler uses index and returns count", async () => {
      vi.mocked(countQuery).mockResolvedValue(5);
      const result = await getMyListingsCountHandler(mockCtx, {
        status: "active",
      });
      expect(result).toBe(5);
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_seller_status",
        expect.any(Function)
      );
    });
  });

  describe("Utility Handlers", () => {
    it("getAuctionBidCountHandler success", async () => {
      vi.mocked(countQuery).mockResolvedValue(10);
      const result = await getAuctionBidCountHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toBe(10);
    });

    it("getCategoriesHandler success", async () => {
      queryMock.collect.mockResolvedValue([
        { _id: "c1", name: "Cat", isActive: true },
      ]);
      const result = await getCategoriesHandler(mockCtx);
      expect(result).toHaveLength(1);
    });

    it("getActiveMakesHandler success", async () => {
      queryMock.collect.mockResolvedValue([
        { make: "JD" },
        { make: "CAT" },
        { make: "JD" },
      ]);
      const result = await getActiveMakesHandler(mockCtx);
      expect(result).toEqual(["CAT", "JD"]);
    });

    it("getEquipmentMetadataHandler success", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "m1", make: "JD" }],
        isDone: true,
        continueCursor: "",
      });
      const result = await getEquipmentMetadataHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(1);
    });
  });

  describe("Error and Edge Cases", () => {
    it("getAuctionByIdHandler visibility rules", async () => {
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        status: "active",
      } as Doc<"auctions">);
      expect(
        await getAuctionByIdHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).not.toBeNull();

      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        status: "draft",
        sellerId: "u1",
      } as Doc<"auctions">);
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue(null);
      expect(
        await getAuctionByIdHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).toBeNull();

      // Ownership branch
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "u1",
        profile: {
          _id: "p1" as Id<"profiles">,
          _creationTime: 100,
          userId: "u1",
          role: "seller",
          isVerified: true,
          createdAt: 100,
          updatedAt: 100,
        } as Doc<"profiles">,
        authUser: { _id: "u1", name: "U1", _creationTime: 100 } as any,
      });
      expect(
        await getAuctionByIdHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).not.toBeNull();
    });

    it("unauthenticated catch blocks", async () => {
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );

      expect(
        (
          await getMyListingsHandler(mockCtx, {
            paginationOpts: { numItems: 10, cursor: null },
          })
        ).page
      ).toHaveLength(0);
      expect(
        await getMyListingsCountHandler(mockCtx, { status: "active" })
      ).toBe(0);
      expect((await getMyListingsStatsHandler(mockCtx)).all).toBe(0);
      expect(await getMyBidsCountHandler(mockCtx)).toBe(0);
      expect((await getMyBidsStatsHandler(mockCtx)).totalActive).toBe(0);
    });

    it("fatal error catch blocks", async () => {
      const fatal = new Error("Fatal");
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(fatal);
      vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(
        getMyBidsHandler(mockCtx, {
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).rejects.toThrow("Fatal");
    });

    it("missing entities in flag list", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "u1",
        name: "Admin",
        _creationTime: 100,
      } as any);
      queryMock.collect.mockResolvedValue([
        { auctionId: "a1", reporterId: "r1", status: "pending" },
      ]);
      vi.mocked(mockCtx.db.get).mockResolvedValue(null);
      vi.mocked(findUserById).mockResolvedValue(null);

      const result = await getAllPendingFlagsHandler(mockCtx);
      expect(result[0].auctionTitle).toBe("Unknown Auction");
      expect(result[0].reporterName).toBe("Unknown User");
    });

    it("getAuctionFlagsHandler should handle missing reporter name but user exists", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({ _id: "admin" } as any);
      queryMock.collect.mockResolvedValue([
        { _id: "f1", reporterId: "r1", auctionId: "a1" },
      ]);
      vi.mocked(findUserById).mockResolvedValue({ _id: "r1" } as any); // Found but no name

      const result = await getAuctionFlagsHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result[0].reporterName).toBe("Unknown User");
    });

    it("getAllPendingFlagsHandler should handle reporter with missing name", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      queryMock.collect.mockResolvedValue([
        { auctionId: "a1", reporterId: "r1", status: "pending" },
      ]);
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        title: "Auction 1",
      } as any);
      vi.mocked(findUserById).mockResolvedValue({ _id: "r1" } as any); // Found but no name

      const result = await getAllPendingFlagsHandler(mockCtx);
      expect(result[0].reporterName).toBe("Unknown User");
    });

    it("getMyListingsStatsHandler should skip unrecognized status", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      queryMock.collect.mockResolvedValue([
        { status: "active" },
        { status: "invalid_status" },
      ]);

      const result = await getMyListingsStatsHandler(mockCtx);
      expect(result.active).toBe(1);
      expect(result.all).toBe(2);
    });

    it("getAuctionByIdHandler returns null for missing auction", async () => {
      vi.mocked(mockCtx.db.get).mockResolvedValue(null);
      const result = await getAuctionByIdHandler(mockCtx, {
        auctionId: "missing" as any,
      });
      expect(result).toBeNull();
    });
  });
});
