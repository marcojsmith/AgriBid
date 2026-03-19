import { v } from "convex/values";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getActiveAuctionsHandler,
  getAuctionBidsHandler,
  getMyBidsHandler,
} from "./queries";
import { authComponent, type AuthUser } from "../auth";
import type { Id, Doc } from "../_generated/dataModel";
import { findUserById } from "../users";
import { countQuery } from "../admin_utils";
import * as auth from "../lib/auth";
import type { QueryCtx } from "../_generated/server";

// Mocking necessary modules
vi.mock("../_generated/server", () => ({
  query: vi.fn((q) => q),
}));

vi.mock("./helpers", () => ({
  toAuctionSummary: vi.fn((_ctx, a) =>
    Promise.resolve({ ...a, categoryName: "Unknown" })
  ),
  toAuctionDetail: vi.fn((_ctx, a) =>
    Promise.resolve({ ...a, categoryName: "Unknown" })
  ),
  AuctionSummaryValidator: v.any(),
  AuctionDetailValidator: v.any(),
  BidValidator: v.any(),
}));

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
  requireAdmin: vi.fn(),
  getAuthenticatedProfile: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  countQuery: vi.fn(),
}));

vi.mock("../users", () => ({
  findUserById: vi.fn(),
}));

interface MockQuery {
  withIndex: (idx: string, cb?: (q: unknown) => unknown) => MockQuery;
  withSearchIndex: (idx: string, cb?: (q: unknown) => unknown) => MockQuery;
  filter: (cb: (q: unknown) => unknown) => MockQuery;
  order: (dir: string) => MockQuery;
  take: (num: number) => Promise<unknown[]>;
  collect: () => Promise<unknown[]>;
  count: () => Promise<number>;
  unique: () => Promise<unknown>;
  paginate: (opts: unknown) => Promise<unknown>;
  [Symbol.asyncIterator]: () => AsyncIterator<unknown>;
}

describe("Queries Branch Coverage Expansion", () => {
  let mockCtx: QueryCtx;
  let queryMock: MockQuery;
  let qMock: {
    eq: ReturnType<typeof vi.fn>;
    neq: ReturnType<typeof vi.fn>;
    gt: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    and: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    field: ReturnType<typeof vi.fn>;
    search: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();

    qMock = {
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      field: vi.fn().mockReturnThis(),
      search: vi.fn().mockReturnThis(),
    };

    const qObj: MockQuery = {
      withIndex: vi.fn((_idx, cb) => {
        if (cb) cb(qMock);
        return qObj;
      }),
      withSearchIndex: vi.fn((_idx, cb) => {
        if (cb) cb(qMock);
        return qObj;
      }),
      filter: vi.fn((cb) => {
        if (cb) cb(qMock);
        return qObj;
      }),
      order: vi.fn().mockReturnThis(),
      take: vi.fn().mockResolvedValue([]),
      collect: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      unique: vi.fn().mockResolvedValue(null),
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
              items = await qObj.collect();
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
    queryMock = qObj;

    mockCtx = {
      db: {
        get: vi.fn().mockResolvedValue(null),
        query: vi.fn(
          () => queryMock as unknown as ReturnType<QueryCtx["db"]["query"]>
        ),
      },
      auth: {
        getUserIdentity: vi.fn(),
      },
    } as unknown as QueryCtx;

    vi.mocked(countQuery).mockImplementation(async (q) => {
      const query = q as unknown as MockQuery;
      // Check if count is a mock function or a real function
      const countFn = query.count as unknown;
      if (typeof countFn === "function") {
        return (await (countFn as () => Promise<number>)()) as number;
      }
      const results = await (query.collect as () => Promise<unknown[]>)();
      return results.length;
    });
  });

  describe("getActiveAuctionsHandler branches", () => {
    it("should handle statusFilter 'all' which leads to statusesForFilter default branch", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "all",
      });
      expect(queryMock.order).toHaveBeenCalledWith("desc");
    });

    it("should handle search with statuses.length > 1", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        search: "tractor",
      });
    });

    it("should handle make with statuses.length > 1", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        make: "John Deere",
      });
    });

    it("should handle year filter without single status", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minYear: 2020,
      });
    });

    it("should handle search result capping with 1001 matching items", async () => {
      vi.mocked(queryMock.take).mockImplementation(async (num) => {
        console.log("Mock take called with:", num);
        return new Array(1001).fill({
          _id: "a1",
          status: "active",
          title: "tractor",
        });
      });
      const result = await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        search: "tractor",
      });
      console.log("Search capping result:", result.totalCount);
      expect(result.totalCount).toBe("1000+");
    });

    it("should cover min/max year branches in getBaseQuery", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "active",
        minYear: 2020,
        maxYear: 2022,
      });
      expect(qMock.gte).toHaveBeenCalledWith("year", 2020);
      expect(qMock.lte).toHaveBeenCalledWith("year", 2022);

      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "active",
        maxYear: 2022,
      });
      expect(qMock.lte).toHaveBeenCalledWith("year", 2022);
    });

    it("should cover pagination and mapping in getActiveAuctionsHandler", async () => {
      vi.mocked(queryMock.paginate).mockResolvedValue({
        page: [{ _id: "a1", status: "active", title: "Tractor" }],
        isDone: true,
        continueCursor: "",
      });
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "cat1" as Id<"equipmentCategories">,
        name: "Tractor Category",
        isActive: true,
      } as unknown as Doc<"equipmentCategories">);

      const result = await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(1);
      expect(result.page[0].title).toBe("Tractor");
    });

    it("should cover price and hours filters in getFilteredQuery", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minPrice: 100,
        maxPrice: 1000,
        maxHours: 500,
      });
      expect(queryMock.filter).toHaveBeenCalled();
    });

    it("should cover default listing when statuses.length > 1", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "closed",
      });
      expect(queryMock.order).toHaveBeenCalledWith("desc");
    });
  });

  describe("getMyBidsHandler sorting", () => {
    it("should sort by ending soonest", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      vi.mocked(queryMock.collect).mockResolvedValue([
        {
          auctionId: "a1",
          bidderId: "u1",
          amount: 100,
          timestamp: 100,
          status: "placed",
        },
        {
          auctionId: "a2",
          bidderId: "u1",
          amount: 200,
          timestamp: 200,
          status: "placed",
        },
      ]);
      vi.mocked(mockCtx.db.get).mockImplementation(async (id: string) => {
        if (id === "a1")
          return {
            _id: id as Id<"auctions">,
            status: "active",
            endTime: 2000,
          } as unknown as Doc<"auctions">;
        return {
          _id: id as Id<"auctions">,
          status: "active",
          endTime: 1000,
        } as unknown as Doc<"auctions">;
      });

      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        sort: "ending",
      });
      expect(result.page[0]._id).toBe("a2");
    });

    it("should handle missing endTime during sorting", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      vi.mocked(queryMock.collect).mockResolvedValue([
        {
          auctionId: "a1",
          bidderId: "u1",
          amount: 100,
          timestamp: 100,
          status: "placed",
        },
        {
          auctionId: "a2",
          bidderId: "u1",
          amount: 200,
          timestamp: 200,
          status: "placed",
        },
      ]);
      vi.mocked(mockCtx.db.get).mockImplementation(async (id: string) => {
        if (id === "a1")
          return {
            _id: id as Id<"auctions">,
            status: "active",
            endTime: undefined,
          } as unknown as Doc<"auctions">;
        return {
          _id: id as Id<"auctions">,
          status: "active",
          endTime: 1000,
        } as unknown as Doc<"auctions">;
      });

      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        sort: "ending",
      });
      expect(result.page[0]._id).toBe("a2");
    });
  });

  describe("getAuctionBidsHandler additional branches", () => {
    it("should reveal bidder name to seller", async () => {
      const longBidderId = "user_1234567890";
      vi.mocked(queryMock.paginate).mockResolvedValue({
        page: [{ _id: "b1", bidderId: longBidderId, auctionId: "a1" }],
        isDone: true,
        continueCursor: "",
      });
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1" as Id<"auctions">,
        sellerId: "seller1",
      } as unknown as Doc<"auctions">);
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "seller1",
        profile: { role: "seller" } as unknown as Doc<"profiles">,
        authUser: {
          _id: "seller1",
          userId: "seller1",
          name: "Seller One",
          _creationTime: Date.now(),
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as AuthUser,
      } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);
      vi.mocked(findUserById).mockResolvedValue({
        _id: longBidderId,
        name: "Real Name",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);

      const result = await getAuctionBidsHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].bidderName).toBe("Real Name");
    });

    it("should handle user not found in getAuctionBidsHandler", async () => {
      const longBidderId = "user_1234567890";
      vi.mocked(queryMock.paginate).mockResolvedValue({
        page: [{ _id: "b1", bidderId: longBidderId, auctionId: "a1" }],
        isDone: true,
        continueCursor: "",
      });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "admin1",
        profile: { role: "admin" } as unknown as Doc<"profiles">,
        authUser: {
          _id: "admin1",
          userId: "admin1",
          name: "Admin User",
          _creationTime: Date.now(),
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as AuthUser,
      } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);
      vi.mocked(findUserById).mockResolvedValue(null);

      const result = await getAuctionBidsHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].bidderName).toBe("Anonymous");
    });
  });

  describe("Queries Branch Expansion Part 2", () => {
    it("should cover return statusQuery branch in getBaseQuery", async () => {
      await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "active",
      });
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_status",
        expect.any(Function)
      );
    });

    it("should cover search mapping branch with matching items", async () => {
      vi.mocked(queryMock.paginate).mockResolvedValue({
        page: [{ _id: "a1", status: "active", title: "Tractor" }],
        isDone: true,
        continueCursor: "",
      });
      vi.mocked(queryMock.take).mockResolvedValue([
        { _id: "a1", status: "active", title: "Tractor" },
      ]);

      const result = await getActiveAuctionsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        search: "Tractor",
        statusFilter: "active",
      });
      expect(result.page).toHaveLength(1);
    });
  });

  describe("getMyBidsHandler branches", () => {
    it("should handle valid numeric cursor", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      vi.mocked(queryMock.collect).mockImplementation(async () => {
        console.log("Mock collect called");
        return [
          {
            auctionId: "a1",
            bidderId: "u1",
            amount: 100,
            timestamp: 100,
            status: "placed",
          },
          {
            auctionId: "a2",
            bidderId: "u1",
            amount: 200,
            timestamp: 200,
            status: "placed",
          },
        ];
      });
      vi.mocked(mockCtx.db.get).mockImplementation(async (id: string) => {
        console.log("Mock db.get called with:", id);
        return { _id: id, status: "active" } as unknown as Doc<"auctions">;
      });

      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 1, cursor: "0" },
      });
      console.log("MyBids page length:", result.page.length);
      expect(result.page).toHaveLength(1);
    });

    it("should handle null userId", async () => {
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it("should handle Unauthenticated error", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockImplementation(() => {
        throw new Error("Unauthenticated");
      });
      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.totalCount).toBe(0);
    });
  });

  describe("Unauthenticated catch blocks", () => {
    it("getMyListingsStatsHandler handles Unauthenticated", async () => {
      const { getMyListingsStatsHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockImplementation(() => {
        throw new Error("Unauthenticated");
      });
      const result = await getMyListingsStatsHandler(mockCtx);
      expect(result.all).toBe(0);
    });

    it("getMyBidsCountHandler handles Unauthenticated", async () => {
      const { getMyBidsCountHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockImplementation(() => {
        throw new Error("Unauthenticated");
      });
      const result = await getMyBidsCountHandler(mockCtx);
      expect(result).toBe(0);
    });

    it("getMyListingsCountHandler handles Unauthenticated", async () => {
      const { getMyListingsCountHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockImplementation(() => {
        throw new Error("Unauthenticated");
      });
      const result = await getMyListingsCountHandler(mockCtx, {});
      expect(result).toBe(0);
    });

    it("getMyListingsHandler handles null userId", async () => {
      const { getMyListingsHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const result = await getMyListingsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it("getMyListingsHandler handles Unauthenticated", async () => {
      const { getMyListingsHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockImplementation(() => {
        throw new Error("Unauthenticated");
      });
      const result = await getMyListingsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.totalCount).toBe(0);
    });

    it("getMyBidsStatsHandler handles Unauthenticated", async () => {
      const { getMyBidsStatsHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockImplementation(() => {
        throw new Error("Unauthenticated");
      });
      const result = await getMyBidsStatsHandler(mockCtx);
      expect(result.totalActive).toBe(0);
    });
  });

  describe("getAuctionBidsHandler branches", () => {
    it("should handle user found but with no name (line 546)", async () => {
      vi.mocked(queryMock.paginate).mockResolvedValue({
        page: [{ _id: "b1", bidderId: "u1", auctionId: "a1" }],
        isDone: true,
        continueCursor: "",
      });
      vi.mocked(findUserById).mockResolvedValue({
        _id: "u1" as unknown as Id<"profiles">,
        name: null,
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof findUserById>>);
      const result = await getAuctionBidsHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].bidderName).toBe("Anonymous");
    });

    it("should fallback to Anonymous if bidderName is missing from map (line 564)", async () => {
      vi.mocked(queryMock.paginate).mockResolvedValue({
        page: [{ _id: "b1", bidderId: "u1", auctionId: "a1" }],
        isDone: true,
        continueCursor: "",
      });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "admin1",
        profile: { role: "admin" } as unknown as Doc<"profiles">,
        authUser: {
          _id: "admin1",
          userId: "admin1",
          name: "Admin User",
          _creationTime: Date.now(),
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as AuthUser,
      } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);
      vi.mocked(findUserById).mockResolvedValue({
        _id: "u1",
        name: "Real Name",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);

      const mapGetSpy = vi
        .spyOn(Map.prototype, "get")
        .mockReturnValue(undefined);

      try {
        const result = await getAuctionBidsHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          paginationOpts: { numItems: 10, cursor: null },
        });

        expect(result.page[0].bidderName).toBe("Anonymous");
      } finally {
        mapGetSpy.mockRestore();
      }
    });
  });

  describe("CalculateUserBidStats additional branches", () => {
    it("should handle multiple bids and update highest bid/timestamp", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      vi.mocked(queryMock.collect).mockResolvedValue([
        {
          auctionId: "a1",
          bidderId: "u1",
          amount: 100,
          timestamp: 100,
          status: "placed",
        },
        {
          auctionId: "a1",
          bidderId: "u1",
          amount: 150,
          timestamp: 50,
          status: "placed",
        },
        {
          auctionId: "a1",
          bidderId: "u1",
          amount: 50,
          timestamp: 150,
          status: "placed",
        },
      ]);
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1" as Id<"auctions">,
        status: "active",
        currentPrice: 150,
        winnerId: "u1",
      } as unknown as Doc<"auctions">);

      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page[0].myHighestBid).toBe(150);
      expect(result.page[0].lastBidTimestamp).toBe(150);
    });

    it("should handle null auction in calculateUserBidStats loop", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "u1",
        name: "Test User",
        _creationTime: Date.now(),
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      vi.mocked(queryMock.collect).mockResolvedValue([
        {
          auctionId: "a1",
          bidderId: "u1",
          amount: 100,
          timestamp: 100,
          status: "placed",
        },
      ]);
      vi.mocked(mockCtx.db.get).mockResolvedValue(null);

      const result = await getMyBidsHandler(mockCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(0);
    });
  });

  describe("Catch blocks for non-Unauthenticated errors", () => {
    it("getMyListingsStatsHandler rethrows non-Unauthenticated error", async () => {
      const { getMyListingsStatsHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Database error")
      );
      await expect(getMyListingsStatsHandler(mockCtx)).rejects.toThrow(
        "Database error"
      );
    });

    it("getMyBidsCountHandler rethrows non-Unauthenticated error", async () => {
      const { getMyBidsCountHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Database error")
      );
      await expect(getMyBidsCountHandler(mockCtx)).rejects.toThrow(
        "Database error"
      );
    });

    it("getMyListingsCountHandler rethrows non-Unauthenticated error", async () => {
      const { getMyListingsCountHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Database error")
      );
      await expect(getMyListingsCountHandler(mockCtx, {})).rejects.toThrow(
        "Database error"
      );
    });

    it("getMyListingsHandler rethrows non-Unauthenticated error", async () => {
      const { getMyListingsHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Database error")
      );
      await expect(
        getMyListingsHandler(mockCtx, {
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).rejects.toThrow("Database error");
    });

    it("getMyBidsStatsHandler rethrows non-Unauthenticated error", async () => {
      const { getMyBidsStatsHandler } = await import("./queries");
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Database error")
      );
      await expect(getMyBidsStatsHandler(mockCtx)).rejects.toThrow(
        "Database error"
      );
    });
  });
});
