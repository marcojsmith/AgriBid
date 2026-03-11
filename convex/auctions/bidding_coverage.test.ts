import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { placeBidHandler } from "./bidding";
import {
  getMyProxyBidHandler,
  getMinIncrement,
  getCurrentHighestBidAmount,
  handleNewBid,
  getProxyBid,
} from "./proxy_bidding";
import * as auth from "../lib/auth";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireVerified: vi.fn(),
  getAuthUser: vi.fn(),
}));

describe("Bidding Coverage", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
          collect: vi.fn().mockResolvedValue([]),
          first: vi.fn().mockResolvedValue(null),
        })),
      },
      auth: {
        getUserIdentity: vi.fn(),
      },
    };
  });

  describe("bidding.ts - placeBid", () => {
    it("should throw error if auction not found", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as any);
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        placeBidHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          amount: 100,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should throw error if auction not active", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as any);
      mockCtx.db.get.mockResolvedValue({ status: "draft" });

      await expect(
        placeBidHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          amount: 100,
        })
      ).rejects.toThrow("Auction not active");
    });

    it("should throw error if seller bids on own auction", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as any);
      mockCtx.db.get.mockResolvedValue({ status: "active", sellerId: "u1" });

      await expect(
        placeBidHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          amount: 100,
        })
      ).rejects.toThrow("Sellers cannot bid on their own auction");
    });

    it("should throw error if auction ended", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as any);
      mockCtx.db.get.mockResolvedValue({
        status: "active",
        sellerId: "u2",
        endTime: Date.now() - 1000,
      });

      await expect(
        placeBidHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          amount: 100,
        })
      ).rejects.toThrow("Auction ended");
    });
  });

  describe("proxy_bidding.ts - getMyProxyBid", () => {
    it("should return null if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getMyProxyBidHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toBeNull();
    });

    it("should return proxy bid for authenticated user", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({ userId: "u1" } as any);
      const mockProxy = { _id: "p1", maxBid: 1000 };
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        unique: vi.fn().mockResolvedValue(mockProxy),
      });

      const result = await getMyProxyBidHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toEqual(mockProxy);
    });
  });

  describe("proxy_bidding.ts - helper functions", () => {
    it("getMinIncrement should use default based on price if field missing", () => {
      const auction = { startingPrice: 5000 } as any;
      expect(getMinIncrement(auction)).toBe(100);

      const expensiveAuction = { startingPrice: 15000 } as any;
      expect(getMinIncrement(expensiveAuction)).toBe(500);
    });

    it("getMinIncrement should use field if present", () => {
      const auction = { startingPrice: 5000, minIncrement: 250 } as any;
      expect(getMinIncrement(auction)).toBe(250);
    });

    it("getCurrentHighestBidAmount should use most recent bid amount", async () => {
      const auction = { _id: "a1", currentPrice: 1000 } as any;
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ amount: 1500 }),
      });

      const amount = await getCurrentHighestBidAmount(
        mockCtx,
        "a1" as Id<"auctions">
      );
      expect(amount).toBe(1500);
    });

    it("getCurrentHighestBidAmount should throw if auction not found", async () => {
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        getCurrentHighestBidAmount(mockCtx, "a1" as Id<"auctions">)
      ).rejects.toThrow("Auction a1 not found");
    });
  });

  describe("proxy_bidding.ts - handleNewBid and resolveProxyBids", () => {
    it("should handle first bid validation", async () => {
      const auction = {
        _id: "a1",
        currentPrice: 1000,
        minIncrement: 100,
        status: "active",
      };
      mockCtx.db.get.mockResolvedValue(auction);

      await expect(
        handleNewBid(mockCtx, "a1" as Id<"auctions">, "u1", 500)
      ).rejects.toThrow("First bid must be at least R1000");
    });

    it("should handle subsequent bid validation", async () => {
      const auction = {
        _id: "a1",
        currentPrice: 1000,
        minIncrement: 100,
        status: "active",
      };
      mockCtx.db.get.mockResolvedValue(auction);
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        filter: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ amount: 1000 }),
      });

      await expect(
        handleNewBid(mockCtx, "a1" as Id<"auctions">, "u1", 1050)
      ).rejects.toThrow("Bid amount must be at least R1100");
    });

    it("should validate proxy maxBid", async () => {
      const auction = {
        _id: "a1",
        currentPrice: 1000,
        minIncrement: 100,
        status: "active",
      };
      mockCtx.db.get.mockResolvedValue(auction);

      await expect(
        handleNewBid(mockCtx, "a1" as Id<"auctions">, "u1", 1100, 1050)
      ).rejects.toThrow(
        "Proxy maximum bid must be at least the current bid amount."
      );
    });

    it("should resolve Case A: someone else has a higher proxy", async () => {
      const auction = {
        _id: "a1",
        currentPrice: 1000,
        minIncrement: 100,
        status: "active",
        reservePrice: 500,
      };
      mockCtx.db.get.mockResolvedValue(auction);

      // Existing proxies: user2 has 2000
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "proxy_bids") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            unique: vi.fn().mockResolvedValue(null), // for upsertProxyBid check
            collect: vi
              .fn()
              .mockResolvedValue([
                { bidderId: "u2", maxBid: 2000, _creationTime: 100 },
              ]),
          };
        }
        return {
          withIndex: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        };
      });

      const result = await handleNewBid(
        mockCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );

      expect(result.bidAmount).toBe(1200); // u2 outbids u1 by 1 increment
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "bids",
        expect.objectContaining({
          bidderId: "u2",
          amount: 1200,
        })
      );
    });

    it("should resolve Case B: current bidder is highest proxy and outbids second highest", async () => {
      const auction = {
        _id: "a1",
        currentPrice: 1000,
        minIncrement: 100,
        status: "active",
        reservePrice: 500,
      };
      mockCtx.db.get.mockResolvedValue(auction);

      // Existing proxies: u1 has 3000, u2 has 2000
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "proxy_bids") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            unique: vi.fn().mockResolvedValue({ _id: "p1", maxBid: 3000 }), // for upsert
            collect: vi.fn().mockResolvedValue([
              { bidderId: "u1", maxBid: 3000, _creationTime: 100 },
              { bidderId: "u2", maxBid: 2000, _creationTime: 200 },
            ]),
          };
        }
        return {
          withIndex: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        };
      });

      const result = await handleNewBid(
        mockCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100,
        3000
      );

      expect(result.bidAmount).toBe(2100); // u1 outbids u2's max bid by 1 increment
      expect(result.proxyBidActive).toBe(true);
      expect(result.nextBidAmount).toBe(2200);
    });

    it("should handle tie-break in resolveProxyBids", async () => {
      const auction = {
        _id: "a1",
        currentPrice: 1000,
        minIncrement: 100,
        status: "active",
      };
      mockCtx.db.get.mockResolvedValue(auction);

      // u2 and u3 both have maxBid 2000, u2 is earlier
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "proxy_bids") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            unique: vi.fn().mockResolvedValue(null),
            collect: vi.fn().mockResolvedValue([
              { bidderId: "u2", maxBid: 2000, _creationTime: 100 },
              { bidderId: "u3", maxBid: 2000, _creationTime: 200 },
            ]),
          };
        }
        return {
          withIndex: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
        };
      });

      const result = await handleNewBid(
        mockCtx,
        "a1" as Id<"auctions">,
        "u1",
        1100
      );
      expect(result.bidAmount).toBe(2000); // u2 outbids u3
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          winnerId: "u2",
        })
      );
    });

    it("should extend auction if within threshold", async () => {
      const now = Date.now();
      const auction = {
        _id: "a1",
        currentPrice: 1000,
        minIncrement: 100,
        status: "active",
        endTime: now + 60000,
      };
      mockCtx.db.get.mockResolvedValue(auction);

      await handleNewBid(mockCtx, "a1" as Id<"auctions">, "u1", 1100);

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          endTime: expect.any(Number),
          isExtended: true,
        })
      );
    });

    it("should NOT extend auction if endTime is missing", async () => {
      const auction = {
        _id: "a1",
        currentPrice: 1000,
        minIncrement: 100,
        status: "active",
        endTime: null,
      };
      mockCtx.db.get.mockResolvedValue(auction);

      await handleNewBid(mockCtx, "a1" as Id<"auctions">, "u1", 1100);

      expect(mockCtx.db.patch).not.toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          isExtended: true,
        })
      );
    });
  });

  describe("getProxyBid", () => {
    it("should retrieve proxy bid", async () => {
      await getProxyBid(mockCtx, "a1" as Id<"auctions">, "u1");
      expect(mockCtx.db.query).toHaveBeenCalledWith("proxy_bids");
    });
  });
});
