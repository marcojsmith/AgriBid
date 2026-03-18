import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { ConvexError } from "convex/values";

import {
  createAuctionHandler,
  saveDraftHandler,
  updateAuctionHandler,
  deleteDraftHandler,
  flagAuctionHandler,
  dismissFlagHandler,
  bulkUpdateAuctionsHandler,
  closeAuctionEarlyHandler,
  deleteUploadHandler,
} from "./mutations";
import * as auth from "../lib/auth";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { logAudit } from "../admin_utils";

// Mocking necessary modules
vi.mock("../_generated/server", () => ({
  query: vi.fn((q) => q),
  mutation: vi.fn((m) => m),
  internalQuery: vi.fn((q) => q),
  internalMutation: vi.fn((m) => m),
}));

vi.mock("../lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
  getCallerRole: vi.fn(),
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireVerified: vi.fn(),
  UnauthorizedError: class extends Error {
    name = "UnauthorizedError";
  },
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("../lib/storage", () => ({
  normalizeImages: vi.fn((i) => i),
  deleteAuctionImages: vi.fn(),
}));

interface MockCtx {
  db: {
    get: Mock;
    insert: Mock;
    patch: Mock;
    delete: Mock;
    query: Mock;
    normalizeId: Mock;
  };
  storage: {
    generateUploadUrl: Mock;
    getUrl: Mock;
    delete: Mock;
  };
  auth: {
    getUserIdentity: Mock;
  };
}

describe("Mutations Branch Coverage Expansion", () => {
  let mockCtx: MockCtx;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue([]),
        })),
        normalizeId: vi.fn((_table, id) => id),
      },
      storage: {
        generateUploadUrl: vi.fn(),
        getUrl: vi.fn(),
        delete: vi.fn(),
      },
      auth: {
        getUserIdentity: vi.fn(),
      },
    };
  });

  describe("deleteUploadHandler", () => {
    it("should handle non-existent storage item gracefully", async () => {
      vi.mocked(mockCtx.storage.getUrl).mockResolvedValue(null);
      const result = await deleteUploadHandler(
        mockCtx as unknown as MutationCtx,
        { storageId: "s1" as Id<"_storage"> }
      );
      expect(result).toBeNull();
      expect(mockCtx.storage.delete).not.toHaveBeenCalled();
    });
  });

  describe("createAuctionHandler branches", () => {
    it("should throw for invalid duration (<= 0)", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      await expect(
        createAuctionHandler(
          mockCtx as unknown as MutationCtx,
          { durationDays: 0 } as unknown as Parameters<
            typeof createAuctionHandler
          >[1]
        )
      ).rejects.toThrow(ConvexError);
    });

    it("should throw for invalid duration (> 365)", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      await expect(
        createAuctionHandler(
          mockCtx as unknown as MutationCtx,
          { durationDays: 366 } as unknown as Parameters<
            typeof createAuctionHandler
          >[1]
        )
      ).rejects.toThrow(ConvexError);
    });

    it("should throw if additional images exceed limit", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      await expect(
        createAuctionHandler(
          mockCtx as unknown as MutationCtx,
          {
            durationDays: 7,
            images: { additional: ["1", "2", "3", "4", "5", "6", "7"] },
          } as unknown as Parameters<typeof createAuctionHandler>[1]
        )
      ).rejects.toThrow("Additional images limit exceeded (max 6)");
    });

    it("should throw if category is not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      vi.mocked(mockCtx.db.get).mockResolvedValue(null);
      await expect(
        createAuctionHandler(
          mockCtx as unknown as MutationCtx,
          {
            durationDays: 7,
            categoryId: "c1" as Id<"equipmentCategories">,
            images: {},
          } as unknown as Parameters<typeof createAuctionHandler>[1]
        )
      ).rejects.toThrow("Invalid categoryId: Category not found");
    });

    it("should use different minIncrement for high starting price", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      vi.mocked(mockCtx.db.get).mockResolvedValue({ _id: "c1" });
      await createAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          durationDays: 7,
          categoryId: "c1" as Id<"equipmentCategories">,
          startingPrice: 15000,
          images: {},
          isDraft: true,
        } as unknown as Parameters<typeof createAuctionHandler>[1]
      );
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auctions",
        expect.objectContaining({
          minIncrement: 500,
        })
      );
    });
  });

  describe("saveDraftHandler branches", () => {
    it("should truncate additional images to 6 instead of throwing", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireVerified>>);
      vi.mocked(mockCtx.db.get).mockResolvedValue({ _id: "c1" });

      await saveDraftHandler(
        mockCtx as unknown as MutationCtx,
        {
          durationDays: 7,
          images: { additional: ["1", "2", "3", "4", "5", "6", "7"] },
          startingPrice: 1000,
        } as unknown as Parameters<typeof saveDraftHandler>[1]
      );

      const insertCall = vi.mocked(mockCtx.db.insert).mock
        .calls[0][1] as unknown as { images: { additional: string[] } };
      expect(insertCall.images.additional).toHaveLength(6);
    });

    it("should throw if auctionId is invalid (normalizeId returns null)", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireVerified>>);
      vi.mocked(mockCtx.db.normalizeId).mockReturnValue(null);

      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            auctionId: "bad",
            durationDays: 7,
            images: {},
          } as unknown as Parameters<typeof saveDraftHandler>[1]
        )
      ).rejects.toThrow("Invalid auctionId provided");
    });

    it("should throw if existing auction is not found", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireVerified>>);
      vi.mocked(mockCtx.db.get).mockResolvedValue(null);

      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            auctionId: "a1",
            durationDays: 7,
            images: {},
          } as unknown as Parameters<typeof saveDraftHandler>[1]
        )
      ).rejects.toThrow("Auction not found");
    });

    it("should validate before publish if status is pending_review", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as unknown as Awaited<ReturnType<typeof auth.requireVerified>>);
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        sellerId: "u1",
        status: "pending_review",
        images: {},
      });

      // Should throw because title/description are missing in restArgs
      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            auctionId: "a1",
            durationDays: 7,
            title: "",
            images: {},
          } as unknown as Parameters<typeof saveDraftHandler>[1]
        )
      ).rejects.toThrow();
    });
  });

  describe("updateAuctionHandler branches", () => {
    it("should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      vi.mocked(mockCtx.db.get).mockResolvedValue(null);
      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: {},
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should handle legacy array images when merging", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        sellerId: "u1",
        status: "draft",
        images: ["img1", "img2"], // Legacy format
      });

      await updateAuctionHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
        updates: { images: { cabin: "img3" } },
      });

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          images: expect.objectContaining({
            front: "img1",
            additional: ["img2"],
            cabin: "img3",
          }),
        })
      );
    });
  });

  describe("deleteDraftHandler branches", () => {
    it("should handle storage deletion failure for condition report gracefully", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        sellerId: "u1",
        status: "draft",
        conditionReportUrl: "s1",
      });
      vi.mocked(mockCtx.storage.delete).mockRejectedValue(
        new Error("Delete failed")
      );
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await deleteDraftHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete condition report"),
        expect.any(Error)
      );
      expect(mockCtx.db.delete).toHaveBeenCalledWith("a1");
      spy.mockRestore();
    });
  });

  describe("flagAuctionHandler branches", () => {
    it("should throw if flagging own auction", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      vi.mocked(mockCtx.db.get).mockResolvedValue({ sellerId: "u1" });
      await expect(
        flagAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          reason: "other",
        })
      ).rejects.toThrow("You cannot flag your own auction");
    });

    it("should not hide if status is not active even if threshold met", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u3");
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        sellerId: "u1",
        status: "pending_review", // Not active
      });

      const mockQuery = {
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { reporterId: "u1", status: "pending" },
          { reporterId: "u2", status: "pending" },
        ]),
      };
      vi.mocked(mockCtx.db.query).mockReturnValue(
        mockQuery as unknown as ReturnType<MutationCtx["db"]["query"]>
      );

      const result = await flagAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions">, reason: "other" }
      );
      expect(result.hideTriggered).toBe(false);
      expect(mockCtx.db.patch).not.toHaveBeenCalled();
    });
  });

  describe("dismissFlagHandler branches", () => {
    it("should handle missing authUser for adminId", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      vi.mocked(mockCtx.db.get).mockImplementation(async (id) => {
        if (id === "f1")
          return { _id: "f1", status: "pending", auctionId: "a1" };
        return null;
      });
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);

      await dismissFlagHandler(mockCtx as unknown as MutationCtx, {
        flagId: "f1" as Id<"auctionFlags">,
      });
      expect(logAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          details: expect.stringContaining('"adminId":"unknown"'),
        })
      );
    });
  });

  describe("closeAuctionEarlyHandler branches", () => {
    it("should handle UnauthorizedError variant", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(
        new Error("Not authorized")
      );
      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Not authorized");
    });

    it("should handle tie-break bid (earlier wins)", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "admin1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>);
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 500,
      });

      const mockQuery = {
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { amount: 1000, timestamp: 200, bidderId: "u2", status: "placed" },
          { amount: 1000, timestamp: 100, bidderId: "u1", status: "placed" }, // Earlier
        ]),
      };
      vi.mocked(mockCtx.db.query).mockReturnValue(
        mockQuery as unknown as ReturnType<MutationCtx["db"]["query"]>
      );

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.winnerId).toBe("u1");
    });

    it("should handle no bids case", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "admin1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>);
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 500,
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.finalStatus).toBe("unsold");
    });
  });

  describe("bulkUpdateAuctionsHandler branches", () => {
    it("should skip missing auctions", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "admin1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>);
      vi.mocked(mockCtx.db.get).mockResolvedValue(null);

      const result = await bulkUpdateAuctionsHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionIds: ["a1" as Id<"auctions">],
          updates: { status: "active" },
        }
      );
      expect(result.skipped).toContain("a1");
      expect(result.updated).toHaveLength(0);
    });

    it("should skip if validation fails for active status", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        _id: "admin1",
      } as unknown as Awaited<ReturnType<typeof auth.requireAdmin>>);
      vi.mocked(mockCtx.db.get).mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        title: "", // Invalid for active
      });

      const result = await bulkUpdateAuctionsHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionIds: ["a1" as Id<"auctions">],
          updates: { status: "active" },
        }
      );
      expect(result.skipped).toContain("a1");
    });
  });
});
