import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import {
  submitLotForReviewHandler,
  approveLotHandler,
  rejectLotHandler,
  submitLotForReview,
  approveLot,
  rejectLot,
} from "./lifecycle";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

vi.mock("../../_generated/server", () => ({
  mutation: vi.fn((config: unknown) => config),
  query: vi.fn((config: unknown) => config),
  internalMutation: vi.fn((config: unknown) => config),
}));

vi.mock("../../lib/auth", () => {
  class UnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  }
  return {
    getAuthenticatedUserId: vi.fn(),
    requireAdmin: vi.fn(),
    UnauthorizedError,
  };
});

const { logActivity } = vi.hoisted(() => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../userActivity", () => ({ logActivity }));

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

const validLot = {
  _id: "l1",
  sellerId: "u1",
  status: "draft",
  title: "Tractor",
  description: "A fine tractor",
  startingPrice: 100,
  reservePrice: 200,
  images: { front: "img1" },
};

describe("Lot lifecycle mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(getHandler(submitLotForReview)).toBe(submitLotForReviewHandler);
      expect(getHandler(approveLot)).toBe(approveLotHandler);
      expect(getHandler(rejectLot)).toBe(rejectLotHandler);
    });
  });

  describe("submit for review", () => {
    it("submits an owned draft lot for review", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(validLot as unknown as Doc<"lots">);

      const result = await submitLotForReviewHandler(
        mockCtx as unknown as MutationCtx,
        { lotId: "l1" as Id<"lots"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "l1", {
        status: "pending_review",
      });
      expect(updateCounter).toHaveBeenCalledWith(mockCtx, "lots", "draft", -1);
      expect(updateCounter).toHaveBeenCalledWith(mockCtx, "lots", "pending", 1);
      expect(logActivity).toHaveBeenCalledWith(
        mockCtx,
        expect.objectContaining({
          userId: "u1",
          type: "listing_created",
          relatedId: "l1",
        })
      );
    });

    it("throws when the lot is missing", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        submitLotForReviewHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Lot not found");
    });

    it("rejects a lot the caller does not own", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u2");
      mockCtx.db.get.mockResolvedValue(validLot as unknown as Doc<"lots">);

      await expect(
        submitLotForReviewHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("You can only modify your own lots");
    });

    it("rejects a lot that is not a draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({
        ...validLot,
        status: "approved",
      } as unknown as Doc<"lots">);

      await expect(
        submitLotForReviewHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Only draft lots can be submitted for review");
    });

    it("rejects an incomplete lot", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({
        ...validLot,
        images: {},
      } as unknown as Doc<"lots">);

      await expect(
        submitLotForReviewHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("At least one image is required before submitting");
    });
  });

  describe("approveLotHandler", () => {
    it("approves a pending_review lot", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>
      );
      mockCtx.db.get.mockResolvedValue({
        ...validLot,
        status: "pending_review",
      } as unknown as Doc<"lots">);

      const result = await approveLotHandler(mockCtx as unknown as MutationCtx, {
        lotId: "l1" as Id<"lots">,
      });

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "l1", {
        status: "approved",
        hiddenByFlags: false,
      });
      expect(updateCounter).toHaveBeenCalledWith(mockCtx, "lots", "pending", -1);
      expect(updateCounter).toHaveBeenCalledWith(mockCtx, "lots", "active", 1);
    });

    it("throws when the lot is missing", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>
      );
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        approveLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Lot not found");
    });

    it("rejects approving a lot not in pending_review", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>
      );
      mockCtx.db.get.mockResolvedValue({
        ...validLot,
        status: "approved",
      } as unknown as Doc<"lots">);

      await expect(
        approveLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Only lots in pending_review can be approved");
    });

    it("propagates a non-admin rejection", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(
        new Error("Not authorized: Admin privileges required")
      );

      await expect(
        approveLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Admin privileges required");
    });
  });

  describe("rejectLotHandler", () => {
    it("rejects a pending_review lot", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>
      );
      mockCtx.db.get.mockResolvedValue({
        ...validLot,
        status: "pending_review",
      } as unknown as Doc<"lots">);

      const result = await rejectLotHandler(mockCtx as unknown as MutationCtx, {
        lotId: "l1" as Id<"lots">,
      });

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "l1", {
        status: "rejected",
        hiddenByFlags: false,
      });
      expect(updateCounter).toHaveBeenCalledWith(mockCtx, "lots", "pending", -1);
    });

    it("rejects rejecting a lot not in pending_review", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>
      );
      mockCtx.db.get.mockResolvedValue({
        ...validLot,
        status: "draft",
      } as unknown as Doc<"lots">);

      await expect(
        rejectLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Only lots in pending_review can be rejected");
    });

    it("throws when the lot is missing", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>
      );
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        rejectLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "l1" as Id<"lots">,
        })
      ).rejects.toThrow("Lot not found");
    });
  });
});
