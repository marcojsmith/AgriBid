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

interface MockDb {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

let mockCtx: { db: MockDb };

const makeQuery = (rows: unknown[]) => {
  const chain = {
    withIndex: vi.fn(() => chain),
    collect: vi.fn().mockResolvedValue(rows),
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
      mockCtx.db.query.mockImplementation((table: string) => {
        if (table === "lots") return makeQuery([assignedLot]);
        return makeQuery([
          { amount: 1500, timestamp: 1500, status: "valid" },
        ]);
      });

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
  });

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
  });
});
