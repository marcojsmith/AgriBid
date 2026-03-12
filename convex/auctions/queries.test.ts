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
  getAuctionBidCountHandler,
  getEquipmentMetadataHandler,
  getCategoriesHandler,
  getAllAuctionsHandler,
  getMyBidsHandler,
  getMyListingsHandler,
  getMyListingsCountHandler,
  getMyListingsStatsHandler,
  getMyBidsCountHandler,
  getMyBidsStatsHandler,
  getAuctionFlagsHandler,
  getAllPendingFlagsHandler,
} from "./queries";
import { authComponent } from "../auth";
import type { QueryCtx } from "../_generated/server";
import type { AuthUser } from "../auth";
import type { Id } from "../_generated/dataModel";

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
    toAuctionSummary: vi.fn((_ctx, a) =>
      Promise.resolve({ _id: a._id, title: a.title })
    ),
    toAuctionDetail: vi.fn((_ctx, a) =>
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
  _id: "u1",
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
        page: [{ _id: "a1", status: "active" }],
        isDone: true,
        continueCursor: "",
      });
      queryMock.take.mockResolvedValue([{ _id: "a1", status: "active" }]);

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

    it("should handle closed status filter", async () => {
      await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
        statusFilter: "closed",
      });
      expect(queryMock.withIndex).not.toHaveBeenCalledWith(
        "by_status",
        expect.any(Function)
      );
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

    it("should allow owner to see draft", async () => {
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "draft",
        sellerId: "u1",
      });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "u1",
        profile: { role: "buyer" },
      } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);
      const result = await getAuctionByIdHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );
      expect(result).not.toBeNull();
    });
  });

  describe("getAuctionBidsHandler", () => {
    it("should return bids with bidder names", async () => {
      const bidderId = "user_123456"; // > 10 chars
      queryMock.paginate.mockResolvedValue({
        page: [{ _id: "b1", bidderId, auctionId: "a1" }],
        isDone: true,
        continueCursor: "",
      });
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: "s1" });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
        userId: "s1",
        profile: { role: "seller" },
      } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);

      const { findUserById } = await import("../users");
      vi.mocked(findUserById).mockResolvedValue({
        name: "John Doe",
      } as unknown as Awaited<ReturnType<typeof findUserById>>);

      const result = await getAuctionBidsHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          paginationOpts: { numItems: 10, cursor: null },
        }
      );
      expect(result.page[0].bidderName).toBe("John Doe");
    });
  });

  describe("getSellerInfoHandler", () => {
    it("should return seller info", async () => {
      const { findUserById } = await import("../users");
      vi.mocked(findUserById).mockResolvedValue({
        name: "Seller",
        createdAt: 100,
      } as unknown as Awaited<ReturnType<typeof findUserById>>);
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

  describe("getMyBidsHandler", () => {
    it("should return user's bids", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      queryMock.collect.mockResolvedValue([
        {
          auctionId: "a1",
          amount: 1000,
          bidderId: "u1",
          timestamp: 100,
          status: "active",
        },
      ]);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        currentPrice: 1000,
        winnerId: "u1",
      });

      const result = await getMyBidsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(result.page).toHaveLength(1);
      expect(result.page[0].isWinning).toBe(true);
    });

    it("should return empty if unauthenticated", async () => {
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
    it("should return counts by status", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      queryMock.collect.mockResolvedValue([
        { status: "active" },
        { status: "active" },
        { status: "sold" },
      ]);

      const result = await getMyListingsStatsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result.active).toBe(2);
      expect(result.sold).toBe(1);
      expect(result.all).toBe(3);
    });
  });

  describe("getAuctionFlagsHandler", () => {
    it("should return flags for admin", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      queryMock.collect.mockResolvedValue([
        { auctionId: "a1", reporterId: "r1", reason: "suspicious" },
      ]);
      const { findUserById } = await import("../users");
      vi.mocked(findUserById).mockResolvedValue({
        name: "Reporter",
      } as unknown as Awaited<ReturnType<typeof findUserById>>);

      const result = await getAuctionFlagsHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result[0].reporterName).toBe("Reporter");
    });
  });

  describe("getAllPendingFlagsHandler", () => {
    it("should return all pending flags", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      queryMock.collect.mockResolvedValue([
        { auctionId: "a1", reporterId: "r1", status: "pending" },
      ]);
      mockCtx.db.get.mockResolvedValue({ title: "Bad Auction" });
      const { findUserById } = await import("../users");
      vi.mocked(findUserById).mockResolvedValue({
        name: "Reporter",
      } as unknown as Awaited<ReturnType<typeof findUserById>>);

      const result = await getAllPendingFlagsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result[0].auctionTitle).toBe("Bad Auction");
    });
  });

  describe("Other Handlers", () => {
    it("getAuctionBidCountHandler should return count", async () => {
      vi.mocked(adminUtils.countQuery).mockResolvedValue(10);
      const result = await getAuctionBidCountHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result).toBe(10);
    });

    it("getEquipmentMetadataHandler should return paginated metadata", async () => {
      const result = await getEquipmentMetadataHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );
      expect(result.page).toBeDefined();
    });

    it("getCategoriesHandler should return active categories", async () => {
      await getCategoriesHandler(mockCtx as unknown as QueryCtx);
      expect(queryMock.filter).toHaveBeenCalled();
    });

    it("getAllAuctionsHandler should require admin", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(mockAdminUser);
      await getAllAuctionsHandler(mockCtx as unknown as QueryCtx, {
        paginationOpts: { numItems: 10, cursor: null },
      });
      expect(auth.requireAdmin).toHaveBeenCalled();
    });

    it("getMyListingsHandler should return user listings", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      const result = await getMyListingsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );
      expect(result.page).toBeDefined();
    });

    it("getMyListingsCountHandler should return count", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      await getMyListingsCountHandler(mockCtx as unknown as QueryCtx, {
        status: "active",
      });
      expect(adminUtils.countQuery).toHaveBeenCalled();
    });

    it("getMyBidsCountHandler should return count", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      const result = await getMyBidsCountHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(typeof result).toBe("number");
    });

    it("getMyBidsStatsHandler should return global stats", async () => {
      vi.mocked(authComponent.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      const result = await getMyBidsStatsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveProperty("totalActive");
    });
  });
});
