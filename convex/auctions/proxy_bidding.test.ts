import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import {
  getMinIncrement,
  getCurrentHighestBidAmount,
  getMostRecentBid,
  handleNewBid,
  getProxyBid,
  getMyProxyBidHandler,
} from "./proxy_bidding";
import { getAuthUser } from "../lib/auth";
import type { AuthUser } from "../auth";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
}));

interface MockCtxType {
  db: {
    get: Mock;
    query: Mock;
    insert: Mock;
    patch: Mock;
  };
}

interface QueryMock {
  withIndex: Mock;
  filter: Mock;
  order: Mock;
  first: Mock;
  unique: Mock;
  collect: Mock;
  paginate: Mock;
}

const createMockQuery = (
  results: Record<string, unknown>[] = []
): QueryMock => {
  const query: QueryMock = {
    withIndex: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(results[0] || null),
    unique: vi.fn().mockResolvedValue(results[0] || null),
    collect: vi.fn().mockResolvedValue(results),
    paginate: vi.fn().mockResolvedValue({
      page: results,
      isDone: true,
      continueCursor: "",
    }),
  };
  return query;
};

describe("Proxy Bidding Coverage", () => {
  let mockCtx: MockCtxType;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        query: vi.fn().mockReturnValue(createMockQuery()),
        insert: vi.fn(),
        patch: vi.fn(),
      },
    };
  });

  describe("getMinIncrement", () => {
    it("should return minIncrement if defined on auction", () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: Date.now(),
        minIncrement: 500,
        startingPrice: 10000,
      } as Doc<"auctions">;

      expect(getMinIncrement(auction)).toBe(500);
    });

    it("should return SMALL_INCREMENT_AMOUNT for low starting prices", () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: Date.now(),
        startingPrice: 5000,
      } as Doc<"auctions">;

      expect(getMinIncrement(auction)).toBe(100);
    });

    it("should return LARGE_INCREMENT_AMOUNT for high starting prices", () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: Date.now(),
        startingPrice: 15000,
      } as Doc<"auctions">;

      expect(getMinIncrement(auction)).toBe(500);
    });
  });

  describe("getMostRecentBid", () => {
    it("should return the most recent non-voided bid", async () => {
      const mockBid = {
        _id: "b1" as Id<"bids">,
        _creationTime: Date.now(),
        auctionId: "a1" as Id<"auctions">,
        bidderId: "u1",
        amount: 1000,
        status: "valid" as const,
      };

      mockCtx.db.query.mockReturnValue(createMockQuery([mockBid]));

      const result = await getMostRecentBid(
        mockCtx as unknown as QueryCtx,
        "a1" as Id<"auctions">
      );

      expect(result).toEqual(mockBid);
    });

    it("should return null if no bids", async () => {
      mockCtx.db.query.mockReturnValue(createMockQuery([]));

      const result = await getMostRecentBid(
        mockCtx as unknown as QueryCtx,
        "a1" as Id<"auctions">
      );

      expect(result).toBeNull();
    });
  });

  describe("getCurrentHighestBidAmount", () => {
    it("should return currentPrice if no bids", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: Date.now(),
        currentPrice: 1000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query.mockReturnValue(createMockQuery([]));

      const result = await getCurrentHighestBidAmount(
        mockCtx as unknown as QueryCtx,
        "a1" as Id<"auctions">
      );

      expect(result).toBe(1000);
    });

    it("should return most recent bid amount if exists", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: Date.now(),
        currentPrice: 1000,
      } as Doc<"auctions">;

      const bid = {
        _id: "b1" as Id<"bids">,
        _creationTime: Date.now(),
        auctionId: "a1" as Id<"auctions">,
        bidderId: "u1",
        amount: 1500,
        status: "valid" as const,
      };

      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query.mockReturnValue(createMockQuery([bid]));

      const result = await getCurrentHighestBidAmount(
        mockCtx as unknown as QueryCtx,
        "a1" as Id<"auctions">
      );

      expect(result).toBe(1500);
    });

    it("should throw if auction not found", async () => {
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        getCurrentHighestBidAmount(
          mockCtx as unknown as QueryCtx,
          "a1" as Id<"auctions">
        )
      ).rejects.toThrow("Auction a1 not found");
    });
  });

  describe("handleNewBid", () => {
    it("should throw if auction not found", async () => {
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        handleNewBid(
          mockCtx as unknown as MutationCtx,
          "a1" as Id<"auctions">,
          "u1",
          1000
        )
      ).rejects.toThrow("Auction not found");
    });

    it("should throw if bid is below starting price", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: Date.now(),
        currentPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query.mockReturnValue(createMockQuery([]));

      await expect(
        handleNewBid(
          mockCtx as unknown as MutationCtx,
          "a1" as Id<"auctions">,
          "u1",
          500
        )
      ).rejects.toThrow("First bid must be at least R1000");
    });

    it("should throw if bid is below currentPrice + increment", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        status: "active",
        startingPrice: 1000,
      } as Doc<"auctions">;
      const recentBid: Record<string, unknown> = { amount: 1000 };
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "bids") return createMockQuery([recentBid]);
        return createMockQuery();
      });

      await expect(
        handleNewBid(
          mockCtx as unknown as MutationCtx,
          "a1" as Id<"auctions">,
          "u1",
          1050
        )
      ).rejects.toThrow(/at least R1100/);
    });

    it("should throw if maxBid is below bidAmount", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        status: "active",
        startingPrice: 1000,
      } as Doc<"auctions">;
      mockCtx.db.get.mockResolvedValue(auction);

      await expect(
        handleNewBid(
          mockCtx as unknown as MutationCtx,
          "a1" as Id<"auctions">,
          "u1",
          1100,
          1050
        )
      ).rejects.toThrow(
        "Proxy maximum bid must be at least the current bid amount."
      );
    });

    it("should meet minimum increment exactly if maxBidLimit allows", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 1000000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        {
          _id: "p1" as Id<"proxy_bids">,
          _creationTime: now - 100,
          auctionId: "a1" as Id<"auctions">,
          bidderId: "u3",
          maxBid: 1100, // Exactly the next required amount
          updatedAt: now - 100,
        },
      ]);

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery([]);
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1000
      );

      expect(result.bidAmount).toBe(1100);
    });

    it("should place bid successfully for first bidder", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: Date.now(),
        currentPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: Date.now() + 100000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query.mockReturnValue(createMockQuery([]));

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      expect(result.success).toBe(true);
      expect(result.bidAmount).toBe(1100);
      expect(result.isProxyBid).toBe(false);
      expect(mockCtx.db.insert).toHaveBeenCalledWith("bids", {
        auctionId: "a1",
        bidderId: "u1",
        amount: 1100,
        timestamp: expect.any(Number) as number,
        status: "valid",
      });
    });

    it("should handle proxy bid creation", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: Date.now(),
        currentPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: Date.now() + 100000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query.mockReturnValue(createMockQuery([]));

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100,
        2000
      );

      expect(result.success).toBe(true);
      expect(result.confirmedMaxBid).toBe(2000);
      expect(result.proxyBidActive).toBe(true);
      expect(mockCtx.db.insert).toHaveBeenCalledWith("proxy_bids", {
        auctionId: "a1",
        bidderId: "u1",
        maxBid: 2000,
        updatedAt: expect.any(Number) as number,
      });
    });

    it("should handle soft close extension", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: now,
        currentPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 60000, // Within soft close threshold (120000ms)
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query.mockReturnValue(createMockQuery([]));

      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          isExtended: true,
        })
      );
    });

    it("should handle existing proxy outbidding new manual bid (Case A)", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: now,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 1000000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        {
          _id: "p1" as Id<"proxy_bids">,
          _creationTime: now - 100,
          auctionId: "a1" as Id<"auctions">,
          bidderId: "u3",
          maxBid: 2000,
          updatedAt: now - 100,
        },
      ]);

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "bids") return createMockQuery([]);
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery([]);
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      expect(result.success).toBe(true);
      expect(result.bidAmount).toBe(1200);
      expect(result.isProxyBid).toBe(true);
    });

    it("should handle new bidder winning proxy battle (Case B)", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: now,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 1000000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        {
          _id: "p1" as Id<"proxy_bids">,
          _creationTime: now - 100,
          auctionId: "a1" as Id<"auctions">,
          bidderId: "u3",
          maxBid: 1500,
          updatedAt: now - 100,
        },
        {
          _id: "p2" as Id<"proxy_bids">,
          _creationTime: now,
          auctionId: "a1" as Id<"auctions">,
          bidderId: "u1",
          maxBid: 2000,
          updatedAt: now,
        },
      ]);

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery([]);
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100,
        2000
      );

      expect(result.success).toBe(true);
      expect(result.bidAmount).toBe(1600);
    });

    it("should break ties using creation time", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: now,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 1000000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        {
          _id: "p1" as Id<"proxy_bids">,
          _creationTime: now - 200,
          auctionId: "a1" as Id<"auctions">,
          bidderId: "u3",
          maxBid: 2000,
          updatedAt: now - 200,
        },
        {
          _id: "p2" as Id<"proxy_bids">,
          _creationTime: now - 100,
          auctionId: "a1" as Id<"auctions">,
          bidderId: "u4",
          maxBid: 2000,
          updatedAt: now - 100,
        },
      ]);

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery([]);
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      expect(result.bidAmount).toBe(2000);
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "bids",
        expect.objectContaining({ bidderId: "u3", amount: 2000 })
      );
    });

    it("should return null from validateAutoBidAmount if maxBidLimit cannot meet increment", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        _creationTime: now,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 1000000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        {
          _id: "p1" as Id<"proxy_bids">,
          _creationTime: now - 100,
          auctionId: "a1" as Id<"auctions">,
          bidderId: "u3",
          maxBid: 1050,
          updatedAt: now - 100,
        },
      ]);

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery([]);
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1000
      );

      expect(result.isProxyBid).toBe(false);
      expect(result.bidAmount).toBe(1000);
    });
  });

  describe("getProxyBid", () => {
    it("should return proxy bid if exists", async () => {
      const proxyBid = {
        _id: "p1" as Id<"proxy_bids">,
        _creationTime: Date.now(),
        auctionId: "a1" as Id<"auctions">,
        bidderId: "u1",
        maxBid: 2000,
        updatedAt: Date.now(),
      };

      mockCtx.db.query.mockReturnValue(createMockQuery([proxyBid]));

      const result = await getProxyBid(
        mockCtx as unknown as QueryCtx,
        "a1" as Id<"auctions">,
        "u1"
      );

      expect(result).toEqual(proxyBid);
    });

    it("should return null if no proxy bid", async () => {
      mockCtx.db.query.mockReturnValue(createMockQuery([]));

      const result = await getProxyBid(
        mockCtx as unknown as QueryCtx,
        "a1" as Id<"auctions">,
        "u1"
      );

      expect(result).toBeNull();
    });
  });

  describe("getMyProxyBidHandler", () => {
    it("should return null if user not authenticated", async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null);

      const result = await getMyProxyBidHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result).toBeNull();
    });

    it("should return proxy bid for authenticated user", async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        userId: "u1",
        _id: "u1",
        email: "test@example.com",
      } as AuthUser);

      const proxyBid = {
        _id: "p1" as Id<"proxy_bids">,
        _creationTime: Date.now(),
        auctionId: "a1" as Id<"auctions">,
        bidderId: "u1",
        maxBid: 2000,
        updatedAt: Date.now(),
      };

      mockCtx.db.query.mockReturnValue(createMockQuery([proxyBid]));

      const result = await getMyProxyBidHandler(
        mockCtx as unknown as QueryCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result).toEqual(proxyBid);
    });

    it("should fallback to _id if userId is missing", async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        _id: "u1",
        email: "test@example.com",
      } as AuthUser);

      const mockQuery = createMockQuery([]);
      mockCtx.db.query.mockReturnValue(mockQuery);

      await getMyProxyBidHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
      });

      expect(mockCtx.db.query).toHaveBeenCalledWith("proxy_bids");
    });
  });

  describe("upsertProxyBid through handleNewBid", () => {
    it("should update existing proxy bid", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 100000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const existingProxy = {
        _id: "p1" as Id<"proxy_bids">,
        bidderId: "u1",
        auctionId: "a1",
        maxBid: 1500,
      };

      mockCtx.db.query.mockImplementation((table) => {
        if (table === "proxy_bids") return createMockQuery([existingProxy]);
        return createMockQuery();
      });

      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100,
        2000
      );

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({
          maxBid: 2000,
        })
      );
    });
  });

  describe("extendAuctionIfNeeded through handleNewBid", () => {
    it("should not extend if endTime is missing", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: undefined, // Missing
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query.mockReturnValue(createMockQuery([]));

      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      expect(mockCtx.db.patch).not.toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          isExtended: true,
        })
      );
    });
  });

  describe("resolveProxyBids additional cases", () => {
    it("should handle Case A with second highest proxy", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 1000000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        {
          _id: "p1" as Id<"proxy_bids">,
          _creationTime: now - 200,
          bidderId: "u3",
          maxBid: 3000,
        },
        {
          _id: "p2" as Id<"proxy_bids">,
          _creationTime: now - 100,
          bidderId: "u4",
          maxBid: 2000,
        },
      ]);

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery([]);
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      // Should be max(1100 + 100, 2000 + 100) = 2100
      expect(result.bidAmount).toBe(2100);
      expect(result.isProxyBid).toBe(true);
    });

    it("should handle Case A where highestProxy.maxBid < bidAmount + minIncrement", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 1000000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        {
          _id: "p1" as Id<"proxy_bids">,
          _creationTime: now - 200,
          bidderId: "u3",
          maxBid: 1150, // Higher than current bid (1100) but lower than next required (1200)
        },
      ]);

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery([]);
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      // It should NOT place an auto-bid because it can't meet increment
      expect(result.isProxyBid).toBe(false);
      expect(result.bidAmount).toBe(1100);
    });

    it("should handle Case A where highestProxy.maxBid is exactly bidAmount + minIncrement", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 1000000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        {
          _id: "p1" as Id<"proxy_bids">,
          _creationTime: now - 200,
          bidderId: "u3",
          maxBid: 1200, // Exactly the next required amount
        },
      ]);

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery([]);
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      expect(result.bidAmount).toBe(1200);
      expect(result.isProxyBid).toBe(true);
    });

    it("should handle Case A with manual bid + increment being larger than second highest proxy", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active" as const,
        sellerId: "u2",
        endTime: now + 1000000,
      } as Doc<"auctions">;

      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        {
          _id: "p1" as Id<"proxy_bids">,
          _creationTime: now - 200,
          bidderId: "u3",
          maxBid: 5000,
        },
        {
          _id: "p2" as Id<"proxy_bids">,
          _creationTime: now - 100,
          bidderId: "u4",
          maxBid: 2000,
        },
      ]);

      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery([]);
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        3000 // manual bid is 3000, + 100 increment = 3100. max(3100, 2000+100) = 3100.
      );

      expect(result.bidAmount).toBe(3100);
    });

    it("should return null from resolveProxyBids if Case B validatedAmount <= bidAmount", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active",
        endTime: now + 100000,
      } as Doc<"auctions">;
      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        { bidderId: "u1", maxBid: 1100, _creationTime: now },
        { bidderId: "u2", maxBid: 1050, _creationTime: now - 100 },
      ]);
      mockCtx.db.query.mockImplementation((table) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery();
      });

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100,
        1100
      );

      // validatedAmount would be 1100, which is NOT > bidAmount (1100)
      expect(result.isProxyBid).toBe(false);
      expect(result.bidAmount).toBe(1100);
    });

    it("should handle Case B where secondMaxPlusIncrement >= targetAmount", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        startingPrice: 1000,
        status: "active",
        endTime: now + 100000,
      } as Doc<"auctions">;
      mockCtx.db.get.mockResolvedValue(auction);

      const proxyQuery = createMockQuery([
        { bidderId: "u1", maxBid: 1200, _creationTime: now }, // highest
        { bidderId: "u2", maxBid: 1150, _creationTime: now - 100 }, // second highest
      ]);
      mockCtx.db.query.mockImplementation((table) => {
        if (table === "proxy_bids") return proxyQuery;
        return createMockQuery();
      });

      // New bid is 1100. minIncrement is 100.
      // secondMaxPlusIncrement = 1150 + 100 = 1250.
      // targetAmount = 1200.
      // 1250 < 1200 is FALSE.
      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100,
        1200
      );

      expect(result.bidAmount).toBe(1200);
    });
  });

  describe("handleNewBid final return coverage", () => {
    it("should have proxyBidActive false if maxBid == bidAmount", async () => {
      const auction = {
        _id: "a1" as Id<"auctions">,
        currentPrice: 1000,
        status: "active",
        startingPrice: 1000,
        endTime: Date.now() + 100000,
      } as Doc<"auctions">;
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query.mockReturnValue(createMockQuery());

      const result = await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100,
        1100
      );

      expect(result.proxyBidActive).toBe(false);
    });
  });
});
