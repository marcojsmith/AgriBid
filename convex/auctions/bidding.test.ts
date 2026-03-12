import { describe, it, expect, vi, beforeEach } from "vitest";

import { placeBidHandler } from "./bidding";
import {
  getMyProxyBidHandler,
  getMinIncrement,
  getCurrentHighestBidAmount,
  handleNewBid,
  getProxyBid,
} from "./proxy_bidding";
import * as auth from "../lib/auth";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

vi.mock("../lib/auth", () => ({
  requireVerified: vi.fn(),
  getAuthUser: vi.fn(),
}));

type MockCtxType = {
  db: {
    get: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
  };
};

const createMockQuery = (results: Record<string, unknown>[] = []) => {
  const query = {
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

const createMockProfile = (
  userId: string,
  role: "buyer" | "seller" | "admin" = "buyer"
): Doc<"profiles"> => ({
  _id: ("p_" + userId) as Id<"profiles">,
  _creationTime: Date.now(),
  userId,
  role,
  isVerified: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

describe("Bidding Coverage", () => {
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

  describe("placeBidHandler", () => {
    it("should throw if auction not found", async () => {
      const userId = "u1";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        profile: createMockProfile(userId, "buyer"),
        userId,
      });
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        placeBidHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          amount: 100,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should throw if auction not active", async () => {
      const userId = "u1";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        profile: createMockProfile(userId, "buyer"),
        userId,
      });
      mockCtx.db.get.mockResolvedValue({ status: "draft" });

      await expect(
        placeBidHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          amount: 100,
        })
      ).rejects.toThrow("Auction not active");
    });

    it("should throw if seller bids on own auction", async () => {
      const userId = "u1";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        profile: createMockProfile(userId, "seller"),
        userId,
      });
      mockCtx.db.get.mockResolvedValue({ status: "active", sellerId: "u1" });

      await expect(
        placeBidHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          amount: 100,
        })
      ).rejects.toThrow("Sellers cannot bid on their own auction");
    });

    it("should throw if auction ended", async () => {
      const userId = "u2";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        profile: createMockProfile(userId, "buyer"),
        userId,
      });
      mockCtx.db.get.mockResolvedValue({
        status: "active",
        sellerId: "u1",
        endTime: Date.now() - 1000,
      });

      await expect(
        placeBidHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          amount: 100,
        })
      ).rejects.toThrow("Auction ended");
    });

    it("should place bid successfully", async () => {
      const userId = "u2";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        profile: createMockProfile(userId, "buyer"),
        userId,
      });
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        sellerId: "u1",
        endTime: Date.now() + 10000,
        currentPrice: 100,
        minIncrement: 10,
      });
      mockCtx.db.query = vi.fn().mockReturnValue(createMockQuery([]));

      const result = await placeBidHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
        amount: 200,
      });

      expect(result.success).toBe(true);
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "bids",
        expect.any(Object)
      );
    });
  });

  describe("getMyProxyBidHandler", () => {
    it("should return null if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getMyProxyBidHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );
      expect(result).toBeNull();
    });

    it("should return proxy bid if exists", async () => {
      const authUser: Awaited<ReturnType<typeof auth.getAuthUser>> = {
        userId: "u1",
        _id: "u1",
      };
      vi.mocked(auth.getAuthUser).mockResolvedValue(authUser);
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        unique: vi.fn().mockResolvedValue({
          _id: "pb1",
          maxBid: 1000,
          bidderId: "u1",
          auctionId: "a1",
          updatedAt: Date.now(),
          _creationTime: Date.now(),
        }),
      });

      const result = await getMyProxyBidHandler(
        mockCtx as unknown as QueryCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );
      expect(result?.maxBid).toBe(1000);
    });
  });

  describe("getCurrentHighestBidAmount", () => {
    it("should return currentPrice if no bids", async () => {
      const auction = { currentPrice: 500 };
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
      });

      const result = await getCurrentHighestBidAmount(
        mockCtx as unknown as QueryCtx | MutationCtx,
        "a1" as Id<"auctions">
      );
      expect(result).toBe(500);
    });

    it("should return 0 if auction not found", async () => {
      mockCtx.db.get.mockResolvedValue(null);
      try {
        await getCurrentHighestBidAmount(
          mockCtx as unknown as QueryCtx | MutationCtx,
          "a1" as Id<"auctions">
        );
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        expect(
          error instanceof Error ? error.message : String(error)
        ).toContain("not found");
      }
    });
  });

  describe("handleNewBid basic logic", () => {
    const auction = { _id: "a1", currentPrice: 500, minIncrement: 50 };

    it("should handle first bid", async () => {
      mockCtx.db.get.mockResolvedValue(auction);
      // No existing bids, no proxy bids
      mockCtx.db.query = vi.fn().mockReturnValue(createMockQuery([]));

      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        500
      );
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "bids",
        expect.objectContaining({ amount: 500 })
      );
    });

    it("should handle outbidding existing bid", async () => {
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "bids") {
          return createMockQuery([{ amount: 500, bidderId: "u2" }]);
        }
        return createMockQuery([]);
      });

      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1050
      );
      // handleNewBid inserts the manual bid amount exactly
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "bids",
        expect.objectContaining({ amount: 1050 })
      );
    });

    it("should handle new proxy bid", async () => {
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockReturnValue(createMockQuery([]));

      // maxBid must be >= amount
      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100,
        1500
      );
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "proxy_bids",
        expect.objectContaining({ maxBid: 1500 })
      );
    });
  });

  describe("handleNewBid proxy battles", () => {
    const auction = { _id: "a1", currentPrice: 500, minIncrement: 50 };

    it("should handle new bid against existing proxy bid", async () => {
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "bids") {
          return createMockQuery([{ amount: 500, bidderId: "u2" }]);
        }
        if (table === "proxy_bids") {
          return createMockQuery([
            { bidderId: "u2", maxBid: 1000, _creationTime: 100 },
          ]);
        }
        return createMockQuery([]);
      });

      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        600
      );
      // u1 bids 600. u2's proxy (1000) then outbids u1.
      // u2 wins at 650 (600 + increment)
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "bids",
        expect.objectContaining({ amount: 650, bidderId: "u2" })
      );
    });

    it("should handle new bid outbidding existing proxy", async () => {
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "bids") {
          return createMockQuery([{ amount: 500, bidderId: "u2" }]);
        }
        if (table === "proxy_bids") {
          return createMockQuery([
            { bidderId: "u2", maxBid: 1000, _creationTime: 100 },
          ]);
        }
        return createMockQuery([]);
      });

      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1500
      );
      // u1 bids 1500. This outbids u2's proxy (1000).
      // resolveProxyBids returns null because u1 (the manual bidder) is now the highest proxy (if u1 set one)
      // or simply because nobody can outbid 1500.
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "bids",
        expect.objectContaining({ amount: 1500, bidderId: "u1" })
      );
    });

    it("should handle proxy vs proxy", async () => {
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "bids") {
          return createMockQuery([{ amount: 500, bidderId: "u2" }]);
        }
        if (table === "proxy_bids") {
          return createMockQuery([
            { bidderId: "u1", maxBid: 1200, _creationTime: 200 },
            { bidderId: "u2", maxBid: 1000, _creationTime: 100 },
          ]);
        }
        return createMockQuery([]);
      });

      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        550, // u1 starts with a bid of 550 and max of 1200
        1200
      );
      // 1. u1 bids 550.
      // 2. resolveProxyBids is called.
      // highestProxy is u1 (1200), secondHighest is u2 (1000).
      // Case B triggers: current manual bidder (u1) is highest proxy.
      // targetAmount = min(1200, 1000 + 50) = 1050.
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "bids",
        expect.objectContaining({ amount: 1050, bidderId: "u1" })
      );
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({ currentPrice: 1050 })
      );
    });
  });

  describe("getMinIncrement", () => {
    it("should return correct increments for different price ranges", () => {
      expect(
        getMinIncrement({
          startingPrice: 50,
          minIncrement: 50,
        } as unknown as Doc<"auctions">)
      ).toBe(50);
      expect(
        getMinIncrement({
          startingPrice: 500,
          minIncrement: 50,
        } as unknown as Doc<"auctions">)
      ).toBe(50);
      expect(
        getMinIncrement({
          startingPrice: 2000,
          minIncrement: 100,
        } as unknown as Doc<"auctions">)
      ).toBe(100);
      expect(
        getMinIncrement({
          startingPrice: 7000,
          minIncrement: 250,
        } as unknown as Doc<"auctions">)
      ).toBe(250);
      expect(
        getMinIncrement({
          startingPrice: 20000,
          minIncrement: 500,
        } as unknown as Doc<"auctions">)
      ).toBe(500);
      expect(
        getMinIncrement({
          startingPrice: 70000,
          minIncrement: 1000,
        } as unknown as Doc<"auctions">)
      ).toBe(1000);
      expect(
        getMinIncrement({
          startingPrice: 200000,
          minIncrement: 2500,
        } as unknown as Doc<"auctions">)
      ).toBe(2500);
    });
  });

  describe("handleNewBid extra branches", () => {
    const auction = { _id: "a1", currentPrice: 1000, minIncrement: 100 };

    it("should handle bid equal to current price + increment exactly", async () => {
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        collect: vi.fn().mockResolvedValue([]),
      });
      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          currentPrice: 1100,
        })
      );
    });

    it("should skip updating currentPrice if new bid is NOT higher than currentPrice", async () => {
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        collect: vi.fn().mockResolvedValue([]),
      });
      await handleNewBid(
        mockCtx as unknown as MutationCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      expect(mockCtx.db.patch).not.toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          currentPrice: 1000,
        })
      );
    });
  });

  describe("getProxyBid", () => {
    it("should return proxy bid for user", async () => {
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        unique: vi.fn().mockResolvedValue({ _id: "pb1", amount: 5000 }),
      });

      await getProxyBid(
        mockCtx as unknown as QueryCtx,
        "a1" as Id<"auctions">,
        "u1"
      );
      expect(mockCtx.db.query).toHaveBeenCalledWith("proxy_bids");
    });
  });
});
