import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import {
  assignLotToAuctionHandler,
  unassignLotHandler,
  assignLotToAuction,
  unassignLot,
} from "./assignment";
import type { Id } from "../../_generated/dataModel";
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

const { issueNextLotNumber } = vi.hoisted(() => ({
  issueNextLotNumber: vi.fn().mockResolvedValue(7),
}));

vi.mock("../../lib/lotCounters", () => ({ issueNextLotNumber }));

const { getBuyerPremiumPct } = vi.hoisted(() => ({
  getBuyerPremiumPct: vi.fn().mockResolvedValue(12),
}));

vi.mock("../../admin/platformSettings", () => ({ getBuyerPremiumPct }));

interface MockDb {
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

let mockCtx: { db: MockDb };

/**
 * Builds a `profiles` query chain resolving to the given seller profile.
 * @param profile - The seller profile (or null when missing).
 * @returns A chainable query mock.
 */
function profileQuery(profile: unknown) {
  return {
    withIndex: vi.fn().mockReturnValue({
      unique: vi.fn().mockResolvedValue(profile),
    }),
  };
}

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
        query: vi.fn().mockReturnValue(profileQuery(null)),
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
        .mockResolvedValueOnce(approvedLot)
        .mockResolvedValueOnce(auctionDoc);

      const result = await assignLotToAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { lotId: "l1" as Id<"lots">, auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "l1", {
        auctionId: "a1",
        lotNumber: 7,
        status: "assigned",
        resolvedBuyerPremiumPct: 0.12,
        premiumSource: "platform",
        resolvedSellerCommissionPct: undefined,
        sellerVatRegistered: undefined,
        sellerType: undefined,
      });
      expect(issueNextLotNumber).toHaveBeenCalledWith(mockCtx, "a1");
    });

    it("falls back to the platform buyer premium as a fraction rounded to 4 dp", async () => {
      getBuyerPremiumPct.mockResolvedValueOnce(12.3456);
      mockCtx.db.get
        .mockResolvedValueOnce(approvedLot)
        .mockResolvedValueOnce(auctionDoc);

      await assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId: "l1" as Id<"lots">,
        auctionId: "a1" as Id<"auctions">,
      });

      const patchArgs = mockCtx.db.patch.mock.calls[0]?.[2] as Record<
        string,
        unknown
      >;
      expect(patchArgs.resolvedBuyerPremiumPct).toBe(0.1235);
      expect(patchArgs.premiumSource).toBe("platform");
    });

    it("always snapshots the platform premium without consulting fee rows", async () => {
      mockCtx.db.get
        .mockResolvedValueOnce(approvedLot)
        .mockResolvedValueOnce(auctionDoc);

      await assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId: "l1" as Id<"lots">,
        auctionId: "a1" as Id<"auctions">,
      });

      expect(mockCtx.db.query).not.toHaveBeenCalledWith("platformFees");
      const patchArgs = mockCtx.db.patch.mock.calls[0]?.[2] as Record<
        string,
        unknown
      >;
      expect(patchArgs.resolvedBuyerPremiumPct).toBe(0.12);
      expect(patchArgs.premiumSource).toBe("platform");
    });

    it("keeps a 0% auction premium as an auction snapshot", async () => {
      mockCtx.db.get.mockResolvedValueOnce(approvedLot).mockResolvedValueOnce({
        ...auctionDoc,
        defaultBuyerPremiumPct: 0,
      });

      await assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId: "l1" as Id<"lots">,
        auctionId: "a1" as Id<"auctions">,
      });

      const patchArgs = mockCtx.db.patch.mock.calls[0]?.[2] as Record<
        string,
        unknown
      >;
      expect(patchArgs.resolvedBuyerPremiumPct).toBe(0);
      expect(patchArgs.premiumSource).toBe("auction");
      expect(getBuyerPremiumPct).not.toHaveBeenCalled();
    });

    it("snapshots the seller's VAT status and type from their profile", async () => {
      mockCtx.db.query.mockReturnValue(
        profileQuery({ vatRegistered: false, sellerType: "private_farmer" })
      );
      mockCtx.db.get
        .mockResolvedValueOnce(approvedLot)
        .mockResolvedValueOnce(auctionDoc);

      await assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId: "l1" as Id<"lots">,
        auctionId: "a1" as Id<"auctions">,
      });

      expect(mockCtx.db.query).toHaveBeenCalledWith("profiles");
      const patchArgs = mockCtx.db.patch.mock.calls[0]?.[2] as Record<
        string,
        unknown
      >;
      expect(patchArgs.sellerVatRegistered).toBe(false);
      expect(patchArgs.sellerType).toBe("private_farmer");
    });

    it("does not consult the platform premium when the auction sets one", async () => {
      mockCtx.db.get.mockResolvedValueOnce(approvedLot).mockResolvedValueOnce({
        ...auctionDoc,
        defaultBuyerPremiumPct: 0.05,
      });

      await assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId: "l1" as Id<"lots">,
        auctionId: "a1" as Id<"auctions">,
      });

      expect(getBuyerPremiumPct).not.toHaveBeenCalled();
    });

    it("snapshots the auction fee defaults onto the lot at assignment", async () => {
      mockCtx.db.get.mockResolvedValueOnce(approvedLot).mockResolvedValueOnce({
        ...auctionDoc,
        defaultBuyerPremiumPct: 0.05,
        defaultSellerCommissionPct: 0.03,
      });

      const result = await assignLotToAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { lotId: "l1" as Id<"lots">, auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "l1", {
        auctionId: "a1",
        lotNumber: 7,
        status: "assigned",
        resolvedBuyerPremiumPct: 0.05,
        premiumSource: "auction",
        resolvedSellerCommissionPct: 0.03,
        commissionSource: "auction",
        sellerVatRegistered: undefined,
        sellerType: undefined,
      });
    });

    it("leaves the commission snapshot undefined when the auction has none", async () => {
      mockCtx.db.get.mockResolvedValueOnce(approvedLot).mockResolvedValueOnce({
        ...auctionDoc,
        defaultBuyerPremiumPct: undefined,
        defaultSellerCommissionPct: undefined,
      });

      await assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
        lotId: "l1" as Id<"lots">,
        auctionId: "a1" as Id<"auctions">,
      });

      const patchArgs = mockCtx.db.patch.mock.calls[0]?.[2] as Record<
        string,
        unknown
      >;
      expect(patchArgs).toHaveProperty("resolvedBuyerPremiumPct", 0.12);
      expect(patchArgs).toHaveProperty(
        "resolvedSellerCommissionPct",
        undefined
      );
      expect(patchArgs).toHaveProperty("commissionSource", undefined);
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
      });

      await expect(
        assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only approved lots can be assigned to an auction");
    });

    it("throws when the auction is missing", async () => {
      mockCtx.db.get
        .mockResolvedValueOnce(approvedLot)
        .mockResolvedValueOnce(null);

      await expect(
        assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("rejects assigning a lot to a closed auction", async () => {
      mockCtx.db.get.mockResolvedValueOnce(approvedLot).mockResolvedValueOnce({
        ...auctionDoc,
        status: "closed",
      });

      await expect(
        assignLotToAuctionHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Cannot assign lots to a closed auction");
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
      });

      const result = await unassignLotHandler(
        mockCtx as unknown as MutationCtx,
        { lotId: "l1" as Id<"lots"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "l1", {
        auctionId: undefined,
        lotNumber: undefined,
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
      mockCtx.db.get.mockResolvedValue(approvedLot);

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
