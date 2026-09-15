import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import {
  assignLotToAuctionHandler,
  unassignLotHandler,
  assignLotToAuction,
  unassignLot,
} from "./assignment";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

vi.mock("../../_generated/server", () => ({
  mutation: vi.fn((config: unknown) => config),
  query: vi.fn((config: unknown) => config),
  internalMutation: vi.fn((config: unknown) => config),
}));

vi.mock("../../lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

const { updateCounter } = vi.hoisted(() => ({
  updateCounter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../admin_utils", () => ({ updateCounter }));

interface MockDb {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

let mockCtx: { db: MockDb };

const approvedLot = {
  _id: "l1",
  sellerId: "u1",
  status: "approved",
  title: "Tractor",
};

const auctionDoc = {
  _id: "a1",
  title: "Sale",
  status: "draft",
  startTime: 1000,
  endTime: 2000,
};

describe("Lot assignment mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.requireAdmin).mockResolvedValue({
      _id: "admin1",
      userId: "admin1",
    });
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue("id"),
        query: vi.fn(),
      },
    };
  });

  describe("Exports", () => {
    it("registers all mutations against their handlers", () => {
      const getHandler = (m: unknown) => (m as { handler: unknown }).handler;
      expect(getHandler(assignLotToAuction)).toBe(assignLotToAuctionHandler);
      expect(getHandler(unassignLot)).toBe(unassignLotHandler);
    });
  });

  describe("assignLotToAuctionHandler", () => {
    it("assigns an approved lot to an auction", async () => {
      mockCtx.db.get
        .mockResolvedValueOnce(approvedLot as unknown as Doc<"lots">)
        .mockResolvedValueOnce(auctionDoc as unknown as Doc<"auctions">);

      const result = await assignLotToAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { lotId: "l1" as Id<"lots">, auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "l1", {
        auctionId: "a1",
        status: "assigned",
        resolvedBuyerPremiumPct: undefined,
        resolvedSellerCommissionPct: undefined,
      });
    });

    it("snapshots the auction fee defaults onto the lot at assignment", async () => {
      mockCtx.db.get
        .mockResolvedValueOnce(approvedLot as unknown as Doc<"lots">)
        .mockResolvedValueOnce({
          ...auctionDoc,
          defaultBuyerPremiumPct: 0.05,
          defaultSellerCommissionPct: 0.03,
        } as unknown as Doc<"auctions">);

      const result = await assignLotToAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { lotId: "l1" as Id<"lots">, auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "l1", {
        auctionId: "a1",
        status: "assigned",
        resolvedBuyerPremiumPct: 0.05,
        resolvedSellerCommissionPct: 0.03,
      });
    });

    it("copies undefined defaults so later auction edits cannot leak in", async () => {
      mockCtx.db.get
        .mockResolvedValueOnce(approvedLot as unknown as Doc<"lots">)
        .mockResolvedValueOnce({
          ...auctionDoc,
          defaultBuyerPremiumPct: undefined,
          defaultSellerCommissionPct: undefined,
        } as unknown as Doc<"auctions">);

      await assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId: "l1" as Id<"lots">,
        auctionId: "a1" as Id<"auctions">,
      });

      const patchArgs = mockCtx.db.patch.mock.calls[0]?.[2] as Record<
        string,
        unknown
      >;
      expect(patchArgs).toHaveProperty("resolvedBuyerPremiumPct", undefined);
      expect(patchArgs).toHaveProperty("resolvedSellerCommissionPct", undefined);
    });

    it("throws when the lot is missing", async () => {
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Lot not found");
    });

    it("rejects assigning a lot that is not approved", async () => {
      mockCtx.db.get.mockResolvedValue({
        ...approvedLot,
        status: "pending_review",
      } as unknown as Doc<"lots">);

      await expect(
        assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only approved lots can be assigned to an auction");
    });

    it("throws when the auction is missing", async () => {
      mockCtx.db.get
        .mockResolvedValueOnce(approvedLot as unknown as Doc<"lots">)
        .mockResolvedValueOnce(null);

      await expect(
        assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("propagates a non-admin rejection", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(
        new Error("Not authorized: Admin privileges required")
      );

      await expect(
        assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Admin privileges required");
    });
  });

  describe("unassignLotHandler", () => {
    it("unassigns an assigned lot back to approved", async () => {
      mockCtx.db.get.mockResolvedValue({
        ...approvedLot,
        status: "assigned",
        auctionId: "a1",
      } as unknown as Doc<"lots">);

      const result = await unassignLotHandler(
        mockCtx as unknown as MutationCtx,
        { lotId: "l1" as Id<"lots"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "l1", {
        auctionId: undefined,
        status: "approved",
      });
    });

    it("throws when the lot is missing", async () => {
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        unassignLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Lot not found");
    });

    it("rejects unassigning a lot that is not assigned", async () => {
      mockCtx.db.get.mockResolvedValue(approvedLot as unknown as Doc<"lots">);

      await expect(
        unassignLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Only assigned lots can be unassigned");
    });

    it("propagates a non-admin rejection", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(
        new Error("Not authorized: Admin privileges required")
      );

      await expect(
        unassignLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Admin privileges required");
    });
  });
});
