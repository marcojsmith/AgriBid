import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import {
  createAuctionHandler,
  updateAuctionHandler,
  publishAuctionContainerHandler,
  closeAuctionContainerHandler,
  createAuction,
  updateAuction,
  publishAuctionContainer,
  closeAuctionContainer,
} from "./adminCrud";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

vi.mock("../../_generated/server", () => ({
  mutation: vi.fn((config: unknown) => config),
  query: vi.fn((config: unknown) => config),
  internalMutation: vi.fn((config: unknown) => config),
}));

vi.mock("../../lib/auth", () => ({
  requireAdmin: vi.fn(),
  resolveUserId: vi.fn(),
}));

const { settleLot, findWinningBid } = vi.hoisted(() => ({
  settleLot: vi.fn().mockResolvedValue("unsold"),
  findWinningBid: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../internal", () => ({ settleLot, findWinningBid }));

interface MockDb {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

let mockCtx: { db: MockDb };

/** Chainable stand-in for the index range Convex hands to `withIndex`. */
interface MockIndexBuilder {
  eq: ReturnType<typeof vi.fn>;
}

/** Query double whose `withIndex` actually runs the supplied index callback. */
interface MockIndexQuery {
  withIndex: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
  indexBuilder: MockIndexBuilder;
}

/**
 * Builds a query double that runs the index callback production code supplies,
 * so the index predicates themselves are exercised.
 *
 * @param rows - Documents `collect` resolves with
 * @returns The query double plus the recorded index range
 */
const makeQuery = (rows: unknown[]): MockIndexQuery => {
  const indexBuilder: MockIndexBuilder = {
    eq: vi.fn(() => indexBuilder),
  };
  const chain: MockIndexQuery = {
    withIndex: vi.fn(
      (_index: string, cb?: (q: MockIndexBuilder) => unknown) => {
        if (cb) cb(indexBuilder);
        return chain;
      }
    ),
    collect: vi.fn().mockResolvedValue(rows),
    indexBuilder,
  };
  return chain;
};

const baseAuction = {
  _id: "a1",
  title: "Spring Sale",
  startTime: 1000,
  endTime: 2000,
  status: "draft",
  createdBy: "admin1",
  createdAt: 1,
  updatedAt: 1,
};

describe("Auction container CRUD mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findWinningBid.mockResolvedValue(undefined);
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "admin1",
      userId: "admin1",
    });
    vi.mocked(auth.resolveUserId).mockReturnValue("admin1");
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue("a1"),
        query: vi.fn(() => makeQuery([])),
      },
    };
  });

  describe("Exports", () => {
    it("registers all mutations against their handlers", () => {
      const getHandler = (m: unknown) => (m as { handler: unknown }).handler;
      expect(getHandler(createAuction)).toBe(createAuctionHandler);
      expect(getHandler(updateAuction)).toBe(updateAuctionHandler);
      expect(getHandler(publishAuctionContainer)).toBe(
        publishAuctionContainerHandler
      );
      expect(getHandler(closeAuctionContainer)).toBe(
        closeAuctionContainerHandler
      );
    });
  });

  describe("createAuctionHandler", () => {
    it("creates a draft auction", async () => {
      const result = await createAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { title: "Spring Sale", startTime: 1000, endTime: 2000 }
      );

      expect(result).toBe("a1");
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auctions",
        expect.objectContaining({
          title: "Spring Sale",
          startTime: 1000,
          endTime: 2000,
          status: "draft",
          createdBy: "admin1",
          createdAt: expect.any(Number) as number,
          updatedAt: expect.any(Number) as number,
        })
      );
    });

    it("rejects an endTime that is not after startTime", async () => {
      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, {
          title: "Bad",
          startTime: 2000,
          endTime: 2000,
        })
      ).rejects.toThrow("Auction endTime must be after startTime");
      expect(mockCtx.db.insert).not.toHaveBeenCalled();
    });

    it("propagates a non-admin rejection", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(
        new Error("Not authorized: Admin privileges required")
      );

      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, {
          title: "Bad",
          startTime: 1000,
          endTime: 2000,
        })
      ).rejects.toThrow("Admin privileges required");
    });
  });

  describe("updateAuctionHandler", () => {
    it("patches provided fields and bumps updatedAt", async () => {
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );

      const result = await updateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions">, title: "Renamed" }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "auctions",
        "a1",
        expect.objectContaining({
          title: "Renamed",
          updatedAt: expect.any(Number) as number,
        })
      );
    });

    it("throws when the auction is missing", async () => {
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("rejects an endTime that is not after startTime", async () => {
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          startTime: 3000,
        })
      ).rejects.toThrow("Auction endTime must be after startTime");
    });

    it("rejects a startTime later than an accepted bid", async () => {
      const assignedLot = {
        _id: "l1",
        status: "assigned",
        auctionId: "a1",
      };
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );
      mockCtx.db.query.mockImplementation((table: string) =>
        table === "lots" ? makeQuery([assignedLot]) : makeQuery([])
      );
      findWinningBid.mockResolvedValue({
        _id: "b1",
        lotId: "l1",
        bidderId: "u1",
        amount: 1500,
        timestamp: 1500,
        status: "valid",
      } as unknown as Doc<"bids">);

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          startTime: 1600,
        })
      ).rejects.toThrow(
        "Auction startTime cannot move later than an accepted bid on an assigned lot"
      );
    });

    it("rejects an endTime below an assigned lot's extendedEndTime", async () => {
      const assignedLot = {
        _id: "l1",
        status: "assigned",
        auctionId: "a1",
        extendedEndTime: 2500,
      };
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "lots") return makeQuery([assignedLot]);
        return makeQuery([]);
      });

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          endTime: 2200,
        })
      ).rejects.toThrow(
        "Auction endTime cannot shorten below an assigned lot's extended end time"
      );
    });

    it("propagates a non-admin rejection", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(
        new Error("Not authorized: Admin privileges required")
      );

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          title: "Renamed",
        })
      ).rejects.toThrow("Admin privileges required");
    });

    it("scopes assigned lots to the auction being updated", async () => {
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );
      const lotsQuery = makeQuery([]);
      mockCtx.db.query.mockReturnValue(lotsQuery);

      await updateAuctionHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
        title: "Renamed",
      });

      expect(lotsQuery.withIndex).toHaveBeenCalledWith(
        "by_auctionId",
        expect.any(Function)
      );
      expect(lotsQuery.indexBuilder.eq).toHaveBeenCalledWith("auctionId", "a1");
    });

    it("scopes the winning-bid lookup to each assigned lot", async () => {
      const assignedLot = {
        _id: "l1",
        status: "assigned",
        auctionId: "a1",
      };
      const bidsQuery = makeQuery([]);
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );
      mockCtx.db.query.mockImplementation((table: string) =>
        table === "lots" ? makeQuery([assignedLot]) : bidsQuery
      );

      await updateAuctionHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
        startTime: 500,
        title: "Renamed",
      });

      expect(bidsQuery.withIndex).not.toHaveBeenCalled();
      expect(findWinningBid).toHaveBeenCalledTimes(1);
      expect(findWinningBid).toHaveBeenCalledWith(mockCtx, "l1");
    });

    it("checks every assigned lot's winning bid, not just the first", async () => {
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );
      mockCtx.db.query.mockImplementation((table: string) =>
        table === "lots"
          ? makeQuery([
              { _id: "l1", status: "assigned", auctionId: "a1" },
              { _id: "l2", status: "assigned", auctionId: "a1" },
            ])
          : makeQuery([])
      );
      findWinningBid
        .mockResolvedValueOnce({ timestamp: 1400 } as unknown as Doc<"bids">)
        .mockResolvedValueOnce({ timestamp: 1500 } as unknown as Doc<"bids">);

      // Both lots' winning bids predate nothing above 1350, so the move stays
      // legal — but only because every assigned lot is checked.
      const result = await updateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions">, startTime: 1350 }
      );

      expect(result.success).toBe(true);
      expect(findWinningBid).toHaveBeenCalledTimes(2);
      expect(findWinningBid).toHaveBeenNthCalledWith(1, mockCtx, "l1");
      expect(findWinningBid).toHaveBeenNthCalledWith(2, mockCtx, "l2");
    });

    it("rejects a startTime later than the highest accepted bid", async () => {
      const assignedLot = {
        _id: "l1",
        status: "assigned",
        auctionId: "a1",
      };
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );
      mockCtx.db.query.mockImplementation((table: string) =>
        table === "lots" ? makeQuery([assignedLot]) : makeQuery([])
      );
      findWinningBid.mockResolvedValue({
        _id: "b1",
        lotId: "l1",
        bidderId: "u1",
        amount: 300,
        timestamp: 1500,
        status: "valid",
      } as unknown as Doc<"bids">);

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          startTime: 1600,
        })
      ).rejects.toThrow(
        "Auction startTime cannot move later than an accepted bid on an assigned lot"
      );
    });

    it("allows a startTime earlier than every accepted bid", async () => {
      const assignedLot = {
        _id: "l1",
        status: "assigned",
        auctionId: "a1",
      };
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );
      mockCtx.db.query.mockImplementation((table: string) =>
        table === "lots" ? makeQuery([assignedLot]) : makeQuery([])
      );
      findWinningBid.mockResolvedValue({
        _id: "b1",
        lotId: "l1",
        bidderId: "u1",
        amount: 300,
        timestamp: 1500,
        status: "valid",
      } as unknown as Doc<"bids">);

      const result = await updateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions">, startTime: 1100 }
      );

      expect(result.success).toBe(true);
    });

    it("ignores an assigned lot whose bids are all voided", async () => {
      const assignedLot = {
        _id: "l1",
        status: "assigned",
        auctionId: "a1",
      };
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );
      mockCtx.db.query.mockImplementation((table: string) =>
        table === "lots" ? makeQuery([assignedLot]) : makeQuery([])
      );
      findWinningBid.mockResolvedValue(undefined);

      const result = await updateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions">, startTime: 1950 }
      );

      expect(result.success).toBe(true);
    });

    it("ignores assigned lots without an extendedEndTime", async () => {
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );
      mockCtx.db.query.mockImplementation((table: string) =>
        table === "lots"
          ? makeQuery([{ _id: "l1", status: "assigned", auctionId: "a1" }])
          : makeQuery([])
      );

      const result = await updateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions">, endTime: 2100 }
      );

      expect(result.success).toBe(true);
    });
  });

  // eslint-disable-next-line no-secrets/no-secrets -- handler function name, not a secret
  describe("publishAuctionContainerHandler", () => {
    it("publishes a draft auction", async () => {
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );

      const result = await publishAuctionContainerHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "auctions",
        "a1",
        expect.objectContaining({ status: "published" })
      );
    });

    it("throws when the auction is missing", async () => {
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        publishAuctionContainerHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("rejects publishing a non-draft auction", async () => {
      mockCtx.db.get.mockResolvedValue({
        ...baseAuction,
        status: "published",
      } as unknown as Doc<"auctions">);

      await expect(
        publishAuctionContainerHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only draft auctions can be published");
    });

    it("rejects publishing with an empty title", async () => {
      mockCtx.db.get.mockResolvedValue({
        ...baseAuction,
        title: "   ",
      } as unknown as Doc<"auctions">);

      await expect(
        publishAuctionContainerHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Title is required before publishing");
    });

    it("rejects publishing with an invalid window", async () => {
      mockCtx.db.get.mockResolvedValue({
        ...baseAuction,
        startTime: 2000,
        endTime: 1000,
      } as unknown as Doc<"auctions">);

      await expect(
        publishAuctionContainerHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction startTime must be before endTime");
    });

    it("preserves a future scheduled startTime on publish (#296)", async () => {
      const futureStart = Date.now() + 86_400_000;
      mockCtx.db.get.mockResolvedValue({
        ...baseAuction,
        startTime: futureStart,
        endTime: futureStart + 3600_000,
      } as unknown as Doc<"auctions">);

      const result = await publishAuctionContainerHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "auctions",
        "a1",
        expect.objectContaining({
          status: "published",
        })
      );
      const patchCall = mockCtx.db.patch.mock.calls[0];
      const patchPayload = patchCall[2] as Record<string, unknown>;
      expect(patchPayload.startTime).toBeUndefined();
    });

    it("preserves a past startTime on publish (no clamping) (#296)", async () => {
      const pastStart = Date.now() - 3600_000;
      mockCtx.db.get.mockResolvedValue({
        ...baseAuction,
        startTime: pastStart,
        endTime: Date.now() + 3600_000,
      } as unknown as Doc<"auctions">);

      const result = await publishAuctionContainerHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      const patchCall = mockCtx.db.patch.mock.calls[0];
      const patchPayload = patchCall[2] as Record<string, unknown>;
      expect(patchPayload.startTime).toBeUndefined();
    });
  });

  describe("closeAuctionContainerHandler", () => {
    it("closes a published auction", async () => {
      mockCtx.db.get.mockResolvedValue({
        ...baseAuction,
        status: "published",
      } as unknown as Doc<"auctions">);

      const result = await closeAuctionContainerHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "auctions",
        "a1",
        expect.objectContaining({ status: "closed" })
      );
    });

    it("settles assigned lots before closing the container", async () => {
      const assignedLots = [
        { _id: "l1", status: "assigned", auctionId: "a1" },
        { _id: "l2", status: "assigned", auctionId: "a1" },
      ];
      mockCtx.db.get.mockResolvedValue({
        ...baseAuction,
        status: "published",
      } as unknown as Doc<"auctions">);
      mockCtx.db.query.mockImplementation((table: string) =>
        table === "lots" ? makeQuery(assignedLots) : makeQuery([])
      );

      const result = await closeAuctionContainerHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(settleLot).toHaveBeenCalledTimes(2);
      expect(settleLot).toHaveBeenCalledWith(
        mockCtx,
        expect.objectContaining({ _id: "l1" }),
        expect.any(Number) as number
      );
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "auctions",
        "a1",
        expect.objectContaining({ status: "closed" })
      );
    });

    it("rejects closing a non-published auction", async () => {
      mockCtx.db.get.mockResolvedValue(
        baseAuction as unknown as Doc<"auctions">
      );

      await expect(
        closeAuctionContainerHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only published auctions can be closed");
    });

    it("throws when the auction is missing", async () => {
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        closeAuctionContainerHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");

      expect(mockCtx.db.query).not.toHaveBeenCalled();
    });

    it("looks up assigned lots by the status+auction compound index", async () => {
      mockCtx.db.get.mockResolvedValue({
        ...baseAuction,
        status: "published",
      } as unknown as Doc<"auctions">);
      const lotsQuery = makeQuery([]);
      mockCtx.db.query.mockReturnValue(lotsQuery);

      await closeAuctionContainerHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
      });

      expect(lotsQuery.withIndex).toHaveBeenCalledWith(
        "by_status_auctionId",
        expect.any(Function)
      );
      expect(lotsQuery.indexBuilder.eq).toHaveBeenCalledWith(
        "status",
        "assigned"
      );
      expect(lotsQuery.indexBuilder.eq).toHaveBeenCalledWith("auctionId", "a1");
      expect(settleLot).not.toHaveBeenCalled();
    });
  });
});
