/* eslint-disable @typescript-eslint/no-explicit-any */
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
  logAudit: vi.fn(),
}));

describe("auction approval mutations", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    const mockDb = {
      get: vi.fn(),
      patch: vi.fn(),
    };
    return {
      db: mockDb as any,
    } as unknown as MutationCtx;
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
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);

      const result = await approveAuctionHandler(mockCtx, {
        auctionId,
        durationDays: 10,
      });

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
        mockCtx,
        "auctions",
        "pending",
        -1
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx,
        "auctions",
        "active",
        1
      );
    });

    it("should throw error if auction not found", async () => {
      mockCtx = setupMockCtx();
      mockCtx.db.get.mockResolvedValue(null);
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);

      await expect(
        approveAuctionHandler(mockCtx, { auctionId: "a1" as any })
      ).rejects.toThrow(ConvexError);
    });

    it("should throw error if auction not in pending_review", async () => {
      mockCtx = setupMockCtx();
      mockCtx.db.get.mockResolvedValue({ status: "active" });
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);

      await expect(
        approveAuctionHandler(mockCtx, { auctionId: "a1" as any })
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
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);

      const result = await rejectAuctionHandler(mockCtx, { auctionId });

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        auctionId,
        expect.objectContaining({
          status: "rejected",
          hiddenByFlags: false,
        })
      );
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx,
        "auctions",
        "pending",
        -1
      );
    });
  });
});
