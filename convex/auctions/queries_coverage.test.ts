
import { describe, it, expect, vi, beforeEach } from "vitest";

import { 
  getActiveAuctionsHandler, 
  getAuctionByIdHandler,
  getMyBidsHandler,
  getPendingAuctionsHandler,
  getActiveMakesHandler,
  getAuctionBidsHandler,
  getAuctionBidCountHandler,
  getEquipmentMetadataHandler,
  getCategoriesHandler,
  getSellerInfoHandler,
  getSellerListingsHandler,
  getAllAuctionsHandler,
  getMyListingsHandler,
  getMyListingsCountHandler,
  getMyListingsStatsHandler,
  getMyBidsCountHandler,
  getMyBidsStatsHandler,
  getAuctionFlagsHandler,
  getAllPendingFlagsHandler
} from "./queries";
import * as auth from "../lib/auth";
import * as helpers from "./helpers";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
  getAuthenticatedProfile: vi.fn(),
  resolveUserId: vi.fn(),
}));

vi.mock("./helpers", () => {
  const { v } = require("convex/values");
  const mv: any = v.any();
  mv.fields = {};
  return {
    toAuctionSummary: vi.fn(),
    toAuctionDetail: vi.fn(),
    AuctionSummaryValidator: mv,
    AuctionDetailValidator: mv,
    BidValidator: mv,
  };
});

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

describe("Queries Coverage", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          withSearchIndex: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue([]),
          paginate: vi.fn().mockResolvedValue({ page: [], isDone: true, continueCursor: "" }),
          take: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        })),
      },
      runQuery: vi.fn().mockResolvedValue(null),
    };
  });

  describe("getActiveAuctionsHandler", () => {
    it("should handle basic active auctions query", async () => {
      await getActiveAuctionsHandler(mockCtx, { paginationOpts: { numItems: 10, cursor: null } });
      expect(mockCtx.db.query).toHaveBeenCalledWith("auctions");
    });

    it("should handle search query", async () => {
      await getActiveAuctionsHandler(mockCtx, { 
        paginationOpts: { numItems: 10, cursor: null },
        search: "tractor" 
      });
    });

    it("should handle complex filters", async () => {
      await getActiveAuctionsHandler(mockCtx, { 
        paginationOpts: { numItems: 10, cursor: null },
        make: "John Deere",
        minYear: 2010,
        maxYear: 2020,
        minPrice: 1000,
        maxPrice: 5000,
        maxHours: 500,
        statusFilter: "all"
      });
    });
  });

  describe("getAuctionByIdHandler", () => {
    it("should return null if auction not found", async () => {
      mockCtx.db.get.mockResolvedValue(null);
      const result = await getAuctionByIdHandler(mockCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).toBeNull();
    });

    it("should enforce visibility for drafts (not owner/admin)", async () => {
      mockCtx.db.get.mockResolvedValue({ status: "draft", sellerId: "u1" });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({ userId: "u2", profile: { role: "buyer" } } as any);
      
      const result = await getAuctionByIdHandler(mockCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).toBeNull();
    });

    it("should allow visibility for drafts if owner", async () => {
      mockCtx.db.get.mockResolvedValue({ status: "draft", sellerId: "u1" });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({ userId: "u1", profile: { role: "buyer" } } as any);
      vi.mocked(helpers.toAuctionDetail).mockResolvedValue({ _id: "a1" } as any);

      const result = await getAuctionByIdHandler(mockCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).not.toBeNull();
    });
  });

  describe("getMyBidsHandler", () => {
    it("should return empty results if not authenticated", async () => {
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      const result = await getMyBidsHandler(mockCtx, { paginationOpts: { numItems: 10, cursor: null } });
      expect(result.page).toHaveLength(0);
    });

    it("should handle authenticated user bids", async () => {
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "bids") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            filter: vi.fn().mockReturnThis(),
            collect: vi.fn().mockResolvedValue([
              { auctionId: "a1", amount: 1000, timestamp: 100 },
            ]),
          };
        }
        return { withIndex: vi.fn().mockReturnThis(), collect: vi.fn().mockResolvedValue([]) };
      });
      
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "active", currentPrice: 1000, winnerId: "u1" });
      vi.mocked(helpers.toAuctionSummary).mockResolvedValue({ _id: "a1" } as any);

      const result = await getMyBidsHandler(mockCtx, { paginationOpts: { numItems: 10, cursor: null } });
      expect(result.totalCount).toBe(1);
      expect(result.page[0].isWinning).toBe(true);
    });
  });

  describe("getPendingAuctionsHandler", () => {
    it("should require admin and return pending auctions", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([{ _id: "a1", status: "pending_review" }]),
      });
      vi.mocked(helpers.toAuctionSummary).mockResolvedValue({ _id: "a1" } as any);

      const result = await getPendingAuctionsHandler(mockCtx);
      expect(result).toHaveLength(1);
      expect(auth.requireAdmin).toHaveBeenCalled();
    });
  });

  describe("getActiveMakesHandler", () => {
    it("should return sorted unique makes", async () => {
      mockCtx.db.query.mockReturnValue({
        filter: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { make: "John Deere", isActive: true },
          { make: "Caterpillar", isActive: true },
          { make: "John Deere", isActive: true },
        ]),
      });
      const result = await getActiveMakesHandler(mockCtx);
      expect(result).toEqual(["Caterpillar", "John Deere"]);
    });
  });

  describe("getAuctionBidsHandler", () => {
    it("should return paginated bids with bidder names", async () => {
      mockCtx.db.query.mockImplementation((table) => {
        if (table === "bids") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            paginate: vi.fn().mockResolvedValue({
              page: [{ bidderId: "u1", amount: 1000 }],
              isDone: true,
              continueCursor: ""
            }),
            count: vi.fn().mockResolvedValue(1),
          };
        }
        return { 
          withIndex: vi.fn().mockReturnThis(), 
          collect: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        };
      });
      mockCtx.db.get.mockResolvedValue({ sellerId: "u2" });
      vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({ userId: "u2", profile: { role: "seller" } } as any);

      const result = await getAuctionBidsHandler(mockCtx, { 
        auctionId: "a1" as Id<"auctions">,
        paginationOpts: { numItems: 10, cursor: null }
      });
      expect(result.page).toHaveLength(1);
    });
  });

  describe("getAuctionBidCountHandler", () => {
    it("should return bid count", async () => {
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        count: vi.fn().mockResolvedValue(5),
      });
      const result = await getAuctionBidCountHandler(mockCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).toBe(5);
    });
  });

  describe("getEquipmentMetadataHandler", () => {
    it("should return paginated equipment metadata", async () => {
      mockCtx.db.query.mockReturnValue({
        paginate: vi.fn().mockResolvedValue({ page: [], isDone: true, continueCursor: "" }),
        count: vi.fn().mockResolvedValue(0),
      });
      const result = await getEquipmentMetadataHandler(mockCtx, { paginationOpts: { numItems: 10, cursor: null } });
      expect(result.page).toBeDefined();
    });
  });

  describe("getCategoriesHandler", () => {
    it("should return active categories", async () => {
      mockCtx.db.query.mockReturnValue({
        filter: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([{ name: "Tractors", isActive: true }]),
      });
      const result = await getCategoriesHandler(mockCtx);
      expect(result).toHaveLength(1);
    });
  });

  describe("getSellerInfoHandler", () => {
    it("should return null if user not found", async () => {
      mockCtx.runQuery.mockResolvedValue(null);
      const result = await getSellerInfoHandler(mockCtx, { sellerId: "u1" });
      expect(result).toBeNull();
    });

    it("should return seller info for valid user", async () => {
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.runQuery.mockResolvedValue({ name: "Seller 1", userId: "u1" });
      mockCtx.db.query.mockImplementation((table) => {
        if (table === "profiles") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            unique: vi.fn().mockResolvedValue({ isVerified: true, role: "Professional" }),
          };
        }
        return { 
          withIndex: vi.fn().mockReturnThis(), 
          collect: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        };
      });
      
      const result = await getSellerInfoHandler(mockCtx, { sellerId: "u1" });
      expect(result).not.toBeNull();
      expect(result?.isVerified).toBe(true);
    });
  });

  describe("getSellerListingsHandler", () => {
    it("should return paginated seller listings", async () => {
      const result = await getSellerListingsHandler(mockCtx, { 
        userId: "u1",
        paginationOpts: { numItems: 10, cursor: null }
      });
      expect(result.page).toBeDefined();
    });
  });

  describe("getAllAuctionsHandler", () => {
    it("should require admin and return all auctions", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      const result = await getAllAuctionsHandler(mockCtx, { 
        paginationOpts: { numItems: 10, cursor: null }
      });
      expect(result.page).toBeDefined();
      expect(auth.requireAdmin).toHaveBeenCalled();
    });
  });

  describe("getMyListingsHandler", () => {
    it("should return empty if unauthenticated", async () => {
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      const result = await getMyListingsHandler(mockCtx, { 
        paginationOpts: { numItems: 10, cursor: null }
      });
      expect(result.page).toHaveLength(0);
    });

    it("should return user listings if authenticated", async () => {
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      const result = await getMyListingsHandler(mockCtx, { 
        paginationOpts: { numItems: 10, cursor: null }
      });
      expect(result.page).toBeDefined();
    });
  });

  describe("getMyListingsCountHandler", () => {
    it("should return count for user listings", async () => {
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      const result = await getMyListingsCountHandler(mockCtx, { status: "active" });
      expect(typeof result).toBe("number");
    });
  });

  describe("getMyListingsStatsHandler", () => {
    it("should return status-grouped stats", async () => {
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { status: "active" },
          { status: "sold" },
          { status: "active" },
        ]),
      });
      const result = await getMyListingsStatsHandler(mockCtx);
      expect(result.active).toBe(2);
      expect(result.sold).toBe(1);
    });
  });

  describe("getMyBidsCountHandler", () => {
    it("should return bid count for user", async () => {
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      const result = await getMyBidsCountHandler(mockCtx);
      expect(typeof result).toBe("number");
    });
  });

  describe("getMyBidsStatsHandler", () => {
    it("should return global bidding stats", async () => {
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      const result = await getMyBidsStatsHandler(mockCtx);
      expect(result).toHaveProperty("totalActive");
    });
  });

  describe("getAuctionFlagsHandler", () => {
    it("should require admin and return flags", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.runQuery.mockResolvedValue({ name: "Reporter 1" });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([{ reporterId: "u1", reason: "misleading" }]),
      });
      const result = await getAuctionFlagsHandler(mockCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).toHaveLength(1);
    });
  });

  describe("getAllPendingFlagsHandler", () => {
    it("should require admin and return pending flags", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.runQuery.mockResolvedValue({ name: "Reporter 1" });
      mockCtx.db.get.mockResolvedValue({ title: "Auction 1" });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([{ auctionId: "a1", reporterId: "u1", status: "pending" }]),
      });
      const result = await getAllPendingFlagsHandler(mockCtx);
      expect(result).toHaveLength(1);
    });
  });
});
