import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import {
  getActiveAuctionsHandler,
  getAuctionByIdHandler,
  getSellerInfoHandler,
  getPendingAuctionsHandler,
  getActiveMakesHandler,
  getAuctionBidsHandler,
  getEquipmentMetadataHandler,
  getCategoriesHandler,
  getMyBidsHandler,
  getMyListingsHandler,
  getMyListingsCountHandler,
  getMyListingsStatsHandler,
  getAllPendingFlagsHandler,
  getSellerListingsHandler,
} from "./queries";
import { authComponent } from "../auth";
import type { QueryCtx } from "../_generated/server";
import type { AuthUser } from "../auth";
import type { Id, Doc } from "../_generated/dataModel";

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
const { summaryValidator, anyValidator } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { v } = require("convex/values");
  return {
    summaryValidator: v.any(),
    anyValidator: v.any(),
  };
});

vi.mock("./helpers", () => {
  return {
    toAuctionSummary: vi.fn((_ctx, a: Doc<"auctions">) =>
      Promise.resolve({
        _id: a._id,
        title: a.title,
        endTime: a.endTime,
        status: a.status,
      })
    ),
    toAuctionDetail: vi.fn((_ctx, a: Doc<"auctions">) =>
      Promise.resolve({ _id: a._id, title: a.title })
    ),
    AuctionSummaryValidator: summaryValidator,
    AuctionDetailValidator: anyValidator,
    BidValidator: anyValidator,
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
  runQuery: ReturnType<typeof vi.fn>;
  getUserIdentity: ReturnType<typeof vi.fn>;
}

const mockAdminUser: AuthUser = {
  _id: "u1" as Id<"profiles">,
  userId: "admin1",
  name: "Admin User",
  email: "admin@test.com",
};

describe("Queries Coverage", () => {
  let mockCtx: MockCtxType;
  let queryMock: {
    withIndex: ReturnType<typeof vi.fn>;
    withSearchIndex: ReturnType<typeof vi.fn>;
    filter: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    take: ReturnType<typeof vi.fn>;
    collect: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    unique: ReturnType<typeof vi.fn>;
    paginate: ReturnType<typeof vi.fn>;
  };

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
      runQuery: vi.fn().mockResolvedValue(null),
      getUserIdentity: vi.fn().mockResolvedValue(null),
    };
  });

  describe("getPendingAuctionsHandler", () => {
    it("should require admin and return pending auctions", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      queryMock.collect.mockResolvedValue([{ _id: "a1", title: "Pending" }]);

      const result = await getPendingAuctionsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(auth.requireAdmin).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe("getActiveAuctionsHandler", () => {
    it("should return paginated active auctions by default", async () => {
      const result = await getActiveAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        {
          paginationOpts: { numItems: 10, cursor: null },
        }
      );
      expect(result.page).toHaveLength(0);
    });

    it("should handle search filter", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "a1", status: "active", title: "tractor" }],
        isDone: true,
        continueCursor: "",
      });
      queryMock.take.mockResolvedValue([
        { _id: "a1", status: "active", title: "tractor" },
      ]);

      const result = await getActiveAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        {
          paginationOpts: { numItems: 10, cursor: null },
          search: "tractor",
        }
      );
      expect(queryMock.withSearchIndex).toHaveBeenCalled();
      expect(result.page).toHaveLength(1);
    });

    it("should handle make filter", async () => {
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        make: "John Deere",
      });
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_status_make",
        expect.any(Function)
      );
    });

    it("should handle year filter", async () => {
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minYear: 2020,
        maxYear: 2022,
      });
      expect(queryMock.withIndex).toHaveBeenCalledWith(
        "by_status_year",
        expect.any(Function)
      );
    });

    it("should handle statusFilter: closed", async () => {
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "closed",
      });
      // Should result in .order("desc") since it's not status="active"
      expect(queryMock.order).toHaveBeenCalledWith("desc");
    });

    it("should handle statusFilter: all", async () => {
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "all",
      });
      expect(queryMock.order).toHaveBeenCalledWith("desc");
    });

    it("should handle price and hours filters", async () => {
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        minPrice: 1000,
        maxPrice: 5000,
        maxHours: 100,
      });
      expect(queryMock.filter).toHaveBeenCalled();
    });

    it("should handle search count cap and manual filtering", async () => {
      const results = Array(1005).fill({
        _id: "a1",
        status: "active",
        title: "tractor",
      });
      queryMock.take.mockResolvedValue(results);
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "a1", status: "active", title: "tractor" }],
        isDone: true,
        continueCursor: "",
      });

      const result = await getActiveAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        {
          paginationOpts: { numItems: 10, cursor: null },
          search: "tractor",
        }
      );
      expect(result.totalCount).toBe("1000+");
    });
  });

  describe("getActiveMakesHandler", () => {
    it("should return sorted unique makes", async () => {
      queryMock.collect.mockResolvedValue([
        { make: "Caterpillar", isActive: true },
        { make: "John Deere" },
        { make: "Caterpillar" },
      ]);
      const result = await getActiveMakesHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toEqual(["Caterpillar", "John Deere"]);
    });
  });

  describe("getAuctionByIdHandler", () => {
    it("should return null if auction not found", async () => {
      mockCtx.db.get.mockResolvedValue(null);
      const result = await getAuctionByIdHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );
      expect(result).toBeNull();
    });

    it("should return auction detail for public status", async () => {
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "active" });
      const result = await getAuctionByIdHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );
      expect(result).not.toBeNull();
    });

    it("should allow admin to see draft", async () => {
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "draft",
        sellerId: "s1",
      });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "admin1",
        authUser: mockAdminUser,
        profile: { role: "admin" } as unknown as Doc<"profiles">,
      });
      const result = await getAuctionByIdHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );
      expect(result).not.toBeNull();
    });

    it("should block non-owner/admin from seeing draft", async () => {
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "draft",
        sellerId: "s1",
      });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "buyer1",
        authUser: { ...mockAdminUser, userId: "buyer1" },
        profile: { role: "buyer" } as unknown as Doc<"profiles">,
      });
      const result = await getAuctionByIdHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );
      expect(result).toBeNull();
    });
  });

  describe("getAuctionBidsHandler", () => {
    it("should handle anonymous bidders and seller/admin visibility", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [
          { _id: "b1", bidderId: "user_1234567890", auctionId: "a1" },
          { _id: "b2", bidderId: "short", auctionId: "a1" },
          { _id: "b3", bidderId: null, auctionId: "a1" },
        ],
        isDone: true,
        continueCursor: "",
      });
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: "s1" });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "s1",
        authUser: { ...mockAdminUser, userId: "s1" },
        profile: { role: "seller" } as unknown as Doc<"profiles">,
      });

      const { findUserById } = await import("../users");
      vi.mocked(findUserById).mockResolvedValue({
        name: "John",
      } as unknown as Doc<"profiles">);

      const result = await getAuctionBidsHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          paginationOpts: { numItems: 10, cursor: null },
        }
      );
      expect(result.page[0].bidderName).toBe("John");
      expect(result.page[1].bidderName).toBe("Anonymous");
      expect(result.page[2].bidderName).toBe("Anonymous");
    });

    it("should mask names for regular users", async () => {
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "b1", bidderId: "user_1234567890", auctionId: "a1" }],
        isDone: true,
        continueCursor: "",
      });
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: "s1" });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "other",
        authUser: { ...mockAdminUser, userId: "other" },
        profile: { role: "buyer" } as unknown as Doc<"profiles">,
      });

      const result = await getAuctionBidsHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          paginationOpts: { numItems: 10, cursor: null },
        }
      );
      expect(result.page[0].bidderName).toBe("Bidder");
    });
  });

  describe("getMyBidsHandler", () => {
    it("should handle sorting and manual pagination", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1" as Id<"profiles">,
        name: "U1",
        email: "u1@test.com",
        userId: "u1",
        _creationTime: 100,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      const bids = [
        {
          auctionId: "a1",
          amount: 1000,
          bidderId: "u1",
          timestamp: 100,
          bidCount: 1,
        },
        {
          auctionId: "a2",
          amount: 2000,
          bidderId: "u1",
          timestamp: 200,
          bidCount: 1,
        },
      ];
      queryMock.collect.mockResolvedValue(bids);

      mockCtx.db.get.mockImplementation(async (id: string) => {
        if (id === "a1")
          return {
            _id: "a1",
            status: "active",
            currentPrice: 1000,
            winnerId: "u1",
            endTime: 500,
          };
        if (id === "a2")
          return {
            _id: "a2",
            status: "active",
            currentPrice: 2000,
            winnerId: "u1",
            endTime: 400,
          };
        return null;
      });

      // Test "ending soonest" sort
      const resultEnding = await getMyBidsHandler(
        mockCtx as unknown as QueryCtx,
        {
          paginationOpts: { numItems: 1, cursor: null },
          sort: "ending",
        }
      );
      expect(resultEnding.page[0]._id).toBe("a2");
      expect(resultEnding.continueCursor).toBe("1");

      // Test default sort (recent)
      const resultRecent = await getMyBidsHandler(
        mockCtx as unknown as QueryCtx,
        {
          paginationOpts: { numItems: 1, cursor: null },
        }
      );
      expect(resultRecent.page[0]._id).toBe("a2"); // a2 has timestamp 200

      // Test cursor
      const resultCursor = await getMyBidsHandler(
        mockCtx as unknown as QueryCtx,
        {
          paginationOpts: { numItems: 1, cursor: "1" },
        }
      );
      expect(resultCursor.page[0]._id).toBe("a1");
      expect(resultCursor.isDone).toBe(true);
    });

    it("should handle batching in calculateUserBidStats", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1" as Id<"profiles">,
        name: "U1",
        email: "u1@test.com",
        userId: "u1",
        _creationTime: 100,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      // 150 unique auctions to trigger CHUNK_SIZE=100
      const bids = Array.from({ length: 150 }, (_, i) => ({
        auctionId: `a${i}`,
        amount: 100,
        bidderId: "u1",
        timestamp: i,
        bidCount: 1,
      }));
      queryMock.collect.mockResolvedValue(bids);
      mockCtx.db.get.mockResolvedValue({ _id: "a0", status: "active" });

      await getMyBidsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(mockCtx.db.get).toHaveBeenCalledTimes(150);
    });

    it("should handle unauthenticated error", async () => {
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const result = await getMyBidsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(0);
    });
  });

  describe("getMyListingsStatsHandler", () => {
    it("should correctly group all status types", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1" as Id<"profiles">,
        name: "U1",
        email: "u1@test.com",
        userId: "u1",
        _creationTime: 100,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      queryMock.collect.mockResolvedValue([
        { status: "draft" },
        { status: "pending_review" },
        { status: "active" },
        { status: "sold" },
        { status: "unsold" },
        { status: "rejected" },
        { status: "unknown" }, // should be ignored
      ]);

      const result = await getMyListingsStatsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result.draft).toBe(1);
      expect(result.active).toBe(1);
      expect(result.all).toBe(7);
    });
  });

  describe("getSellerInfoHandler", () => {
    it("should return seller info", async () => {
      const { findUserById } = await import("../users");
      vi.mocked(findUserById).mockResolvedValue({
        name: "Seller",
        createdAt: 100,
      } as unknown as Doc<"profiles">);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      queryMock.unique.mockResolvedValue({ isVerified: true, role: "seller" });
      vi.mocked(adminUtils.countQuery).mockResolvedValue(5);

      const result = await getSellerInfoHandler(
        mockCtx as unknown as QueryCtx,
        { sellerId: "u1" }
      );
      expect(result).toEqual({
        name: "Seller",
        isVerified: true,
        role: "seller",
        createdAt: 100,
        itemsSold: 5,
        totalListings: 5,
      });
    });
  });

  describe("Other Handlers and Catch Blocks", () => {
    it("getMyListingsHandler should handle unauthenticated", async () => {
      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const result = await getMyListingsHandler(
        mockCtx as unknown as QueryCtx,
        {
          paginationOpts: { numItems: 10, cursor: null },
        }
      );
      expect(result.page).toHaveLength(0);
    });

    it("getMyListingsCountHandler should handle status and unauthenticated", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1" as Id<"profiles">,
        name: "U1",
        email: "u1@test.com",
        userId: "u1",
        _creationTime: 100,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      await getMyListingsCountHandler(mockCtx as unknown as QueryCtx, {
        status: "sold",
      });
      expect(queryMock.filter).toHaveBeenCalled();

      vi.mocked(authComponent.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      expect(
        await getMyListingsCountHandler(mockCtx as unknown as QueryCtx, {})
      ).toBe(0);
    });

    it("getSellerListingsHandler should return listings", async () => {
      const result = await getSellerListingsHandler(
        mockCtx as unknown as QueryCtx,
        {
          userId: "u1",
          paginationOpts: { numItems: 10, cursor: null },
        }
      );
      expect(result.page).toBeDefined();
    });

    it("getEquipmentMetadataHandler should return metadata", async () => {
      const result = await getEquipmentMetadataHandler(
        mockCtx as unknown as QueryCtx,
        {
          paginationOpts: { numItems: 10, cursor: null },
        }
      );
      expect(result).toBeDefined();
    });

    it("getCategoriesHandler should return categories", async () => {
      const result = await getCategoriesHandler(mockCtx as unknown as QueryCtx);
      expect(result).toBeDefined();
    });

    it("getAllPendingFlagsHandler should handle missing entities", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      queryMock.collect.mockResolvedValue([
        {
          auctionId: "a1" as Id<"auctions">,
          reporterId: "r1",
          status: "pending",
        },
      ]);
      mockCtx.db.get.mockResolvedValue(null);
      const { findUserById } = await import("../users");
      vi.mocked(findUserById).mockResolvedValue(null);

      const result = await getAllPendingFlagsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result[0].auctionTitle).toBe("Unknown Auction");
      expect(result[0].reporterName).toBe("Unknown User");
    });
  });
});
