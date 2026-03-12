import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { approveAuctionHandler, rejectAuctionHandler } from "./mutations";
import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
}));

type MockCtx = {
  db: {
    get: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    system: unknown;
    normalizeId: ReturnType<typeof vi.fn>;
  };
  storage: unknown;
  auth: unknown;
  scheduler: unknown;
  runMutation: unknown;
  runQuery: unknown;
  runAction: unknown;
};

describe("auction approval mutations", () => {
  let mockCtx: MockCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    return {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        replace: vi.fn(),
        delete: vi.fn(),
        query: vi.fn(),
        system: {},
        normalizeId: vi.fn((_table: string, id: string) => id),
      },
    } as unknown as MockCtx;
  };

  describe("approveAuction", () => {
    it("should allow an admin to approve an auction", async () => {
      const auctionId = "auction123" as Id<"auctions">;
      const auctionDoc = {
        _id: auctionId,
        status: "pending_review",
        durationDays: 5,
      };

      mockCtx = setupMockCtx();
      mockCtx.db.get.mockResolvedValue(auctionDoc);
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "admin",
        userId: "admin",
      });

      const result = await approveAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId,
          durationDays: 10,
        }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        auctionId,
        expect.objectContaining({
          status: "active",
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          hiddenByFlags: false,
        })
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx as unknown as MutationCtx,
        "auctions",
        "pending",
        -1
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx as unknown as MutationCtx,
        "auctions",
        "active",
        1
      );
    });

    it("should throw error if auction not found", async () => {
      mockCtx = setupMockCtx();
      mockCtx.db.get.mockResolvedValue(null);
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "admin",
        userId: "admin",
      });

      await expect(
        approveAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow(ConvexError);
    });

    it("should throw error if auction not in pending_review", async () => {
      mockCtx = setupMockCtx();
      mockCtx.db.get.mockResolvedValue({ status: "active" });
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "admin",
        userId: "admin",
      });

      await expect(
        approveAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only auctions in pending_review can be approved");
    });
  });

  describe("rejectAuction", () => {
    it("should allow an admin to reject an auction", async () => {
      const auctionId = "auction123" as Id<"auctions">;
      const auctionDoc = {
        _id: auctionId,
        status: "pending_review",
      };

      mockCtx = setupMockCtx();
      mockCtx.db.get.mockResolvedValue(auctionDoc);
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "admin",
        userId: "admin",
      });

      const result = await rejectAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        auctionId,
        expect.objectContaining({
          status: "rejected",
          hiddenByFlags: false,
        })
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx as unknown as MutationCtx,
        "auctions",
        "pending",
        -1
      );
    });
  });
});
