import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import * as auth from "../lib/auth";
import * as adminUtils from "../admin_utils";
import * as internalHelpers from "./helpers";
import type { Id } from "../_generated/dataModel";

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  resolveUserId: vi.fn(),
  getCallerRole: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
  requireVerified: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    name = "UnauthorizedError";
  },
}));

vi.mock("../admin_utils", () => ({
  updateCounter: vi.fn(),
  adjustStatusCounters: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("./helpers", () => ({
  validateAuctionBeforePublish: vi.fn(),
  validateAuctionStatus: vi.fn(),
  deleteAuctionImages: vi.fn(),
}));

import {
  updateAuctionHandler,
  publishAuctionHandler,
  deleteDraftHandler,
  flagAuctionHandler,
  dismissFlagHandler,
  approveAuctionHandler,
  rejectAuctionHandler,
  adminUpdateAuctionHandler,
  bulkUpdateAuctionsHandler,
  generateUploadUrlHandler,
  deleteUploadHandler,
  createAuctionHandler,
  saveDraftHandler,
} from "./mutations";

describe("Mutations Coverage", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnThis(),
          collect: vi.fn().mockResolvedValue([]),
        }),
        normalizeId: vi.fn((table, id) => id),
      },
      storage: {
        delete: vi.fn(),
        generateUploadUrl: vi.fn(),
        getUrl: vi.fn(),
      },
    };
  });

  describe("updateAuctionHandler", () => {
    it("should recompute currentPrice and minIncrement when startingPrice is updated", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "draft",
      });

      // Case 1: startingPrice < 10000
      await updateAuctionHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        updates: { startingPrice: 5000 },
      });
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          currentPrice: 5000,
          minIncrement: 100,
        })
      );

      // Case 2: startingPrice >= 10000
      await updateAuctionHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        updates: { startingPrice: 15000 },
      });
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          currentPrice: 15000,
          minIncrement: 500,
        })
      );
    });

    it("should throw error for invalid durationDays", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "draft",
      });

      await expect(
        updateAuctionHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { durationDays: 0 },
        })
      ).rejects.toThrow("Invalid duration: must be between 1 and 365 days");

      await expect(
        updateAuctionHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { durationDays: 400 },
        })
      ).rejects.toThrow("Invalid duration: must be between 1 and 365 days");
    });

    it("should merge images correctly (existing as array)", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "draft",
        images: ["img1", "img2"],
      });

      await updateAuctionHandler(mockCtx, {
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

    it("should merge images correctly (existing as object)", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "draft",
        images: { front: "img1" },
      });

      await updateAuctionHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        updates: { images: { engine: "img2" } },
      });

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          images: { front: "img1", engine: "img2" },
        })
      );
    });

    it("should throw error if additional images limit exceeded", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "draft",
      });

      await expect(
        updateAuctionHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: {
            images: { additional: ["1", "2", "3", "4", "5", "6", "7"] },
          },
        })
      ).rejects.toThrow("Additional images limit exceeded (max 6)");
    });

    it("should validate auction if status is pending_review", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "pending_review",
        title: "Test",
        description: "Test description",
        startingPrice: 100,
        reservePrice: 100,
        images: { front: "img1" },
      });

      await updateAuctionHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        updates: { title: "Updated" },
      });

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          title: "Updated",
        })
      );
    });
  });

  describe("publishAuctionHandler", () => {
    it("should throw error if auction status is not draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "active",
      });

      await expect(
        publishAuctionHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only draft auctions can be published");
    });
  });

  describe("deleteDraftHandler", () => {
    it("should delete condition report if exists", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "draft",
        conditionReportUrl: "storage123",
      });

      await deleteDraftHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
      });

      expect(mockCtx.storage.delete).toHaveBeenCalledWith("storage123");
      expect(mockCtx.db.delete).toHaveBeenCalledWith("a1");
    });

    it("should handle condition report deletion failure gracefully", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "draft",
        conditionReportUrl: "storage123",
      });
      mockCtx.storage.delete.mockRejectedValue(new Error("Storage fail"));

      const result = await deleteDraftHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
      });

      expect(result.success).toBe(true);
      expect(mockCtx.db.delete).toHaveBeenCalledWith("a1");
    });

    it("should throw error if auction status is not draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "pending_review",
      });

      await expect(
        deleteDraftHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only draft auctions can be deleted");
    });
  });

  describe("flagAuctionHandler", () => {
    it("should throw error if seller flags own auction", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
      });

      await expect(
        flagAuctionHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          reason: "other",
        })
      ).rejects.toThrow("You cannot flag your own auction");
    });

    it("should throw error if user already flagged", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user456");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
      });
      mockCtx.db
        .query()
        .collect.mockResolvedValue([
          { reporterId: "user456", status: "pending" },
        ]);

      await expect(
        flagAuctionHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          reason: "other",
        })
      ).rejects.toThrow("You have already flagged this auction");
    });

    it("should auto-hide auction when flag threshold is reached", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_new");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "user123",
        status: "active",
      });
      mockCtx.db.query().collect.mockResolvedValue([
        { reporterId: "u1", status: "pending" },
        { reporterId: "u2", status: "pending" },
      ]);

      const result = await flagAuctionHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        reason: "other",
      });

      expect(result.hideTriggered).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "pending_review",
          hiddenByFlags: true,
        })
      );
    });
  });

  describe("dismissFlagHandler", () => {
    it("should throw error if not authorized", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("user");

      await expect(
        dismissFlagHandler(mockCtx, {
          flagId: "f1" as Id<"auctionFlags">,
        })
      ).rejects.toThrow("Not authorized");
    });

    it("should throw error if flag not found", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        dismissFlagHandler(mockCtx, {
          flagId: "f1" as Id<"auctionFlags">,
        })
      ).rejects.toThrow("Flag not found");
    });

    it("should throw error if flag already reviewed", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get.mockResolvedValue({ status: "dismissed" });

      await expect(
        dismissFlagHandler(mockCtx, {
          flagId: "f1" as Id<"auctionFlags">,
        })
      ).rejects.toThrow("Flag has already been reviewed");
    });

    it("should restore auction if flags fall below threshold", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get.mockImplementation((id: string) => {
        if (id === "f1")
          return {
            _id: "f1",
            auctionId: "a1",
            status: "pending",
            reason: "test",
          };
        if (id === "a1")
          return { _id: "a1", status: "pending_review", hiddenByFlags: true };
        return null;
      });

      // Remaining flags: 2 (below threshold 3)
      mockCtx.db.query().collect.mockResolvedValue([
        { reporterId: "u1", status: "pending" },
        { reporterId: "u2", status: "pending" },
      ]);

      const result = await dismissFlagHandler(mockCtx, {
        flagId: "f1" as Id<"auctionFlags">,
      });

      expect(result.auctionRestored).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "active",
          hiddenByFlags: false,
        })
      );
    });
  });

  describe("approveAuctionHandler", () => {
    it("should throw error for invalid duration", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "pending_review" });

      await expect(
        approveAuctionHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
          durationDays: 0,
        })
      ).rejects.toThrow("Invalid duration");
    });

    it("should throw error if status is not pending_review", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "draft" });

      await expect(
        approveAuctionHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only auctions in pending_review can be approved");
    });
  });

  describe("rejectAuctionHandler", () => {
    it("should throw error if status is not pending_review", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "active" });

      await expect(
        rejectAuctionHandler(mockCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only auctions in pending_review can be rejected");
    });
  });

  describe("adminUpdateAuctionHandler", () => {
    it("should validate status if becoming active", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "draft" });

      await adminUpdateAuctionHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        updates: { status: "active", endTime: Date.now() + 10000 },
      });

      expect(mockCtx.db.patch).toHaveBeenCalled();
    });

    it("should clear hiddenByFlags if transitioning from pending_review", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        hiddenByFlags: true,
      });

      await adminUpdateAuctionHandler(mockCtx, {
        auctionId: "a1" as Id<"auctions">,
        updates: { status: "active", endTime: Date.now() + 10000 },
      });

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          hiddenByFlags: false,
        })
      );
    });
  });

  describe("bulkUpdateAuctionsHandler", () => {
    it("should throw error if limit exceeded", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);

      const ids = Array(101).fill("a1");
      await expect(
        bulkUpdateAuctionsHandler(mockCtx, {
          auctionIds: ids,
          updates: { status: "sold" },
        })
      ).rejects.toThrow("Bulk update exceeds limit");
    });

    it("should handle skipped auctions if validation fails", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "draft" });
      vi.mocked(internalHelpers.validateAuctionStatus).mockImplementation(
        () => {
          throw new Error("Invalid");
        }
      );

      const result = await bulkUpdateAuctionsHandler(mockCtx, {
        auctionIds: ["a1" as Id<"auctions">],
        updates: { status: "active" },
      });

      expect(result.skipped).toContain("a1");
      expect(result.updated).toHaveLength(0);
    });
  });

  describe("generateUploadUrl and deleteUpload", () => {
    it("should generate upload url", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({ userId: "u1" } as any);
      mockCtx.storage.generateUploadUrl.mockResolvedValue("url123");

      const result = await generateUploadUrlHandler(mockCtx);
      expect(result).toBe("url123");
    });

    it("should delete upload", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.storage.getUrl.mockResolvedValue("url");

      await deleteUploadHandler(mockCtx, { storageId: "s1" as Id<"_storage"> });
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("s1");
    });

    it("should warn if deleting non-existent upload", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as any);
      mockCtx.storage.getUrl.mockResolvedValue(null);
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await deleteUploadHandler(mockCtx, { storageId: "s1" as Id<"_storage"> });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("createAuction", () => {
    const validArgs = {
      title: "Title",
      categoryId: "cat1" as Id<"equipmentCategories">,
      make: "Make",
      model: "Model",
      year: 2020,
      operatingHours: 100,
      location: "Loc",
      description: "Desc",
      startingPrice: 1000,
      reservePrice: 2000,
      durationDays: 7,
      images: { front: "img1" },
      conditionChecklist: {
        engine: true,
        hydraulics: true,
        tires: true,
        serviceHistory: true,
      },
    };

    it("should create a draft auction successfully", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "cat1" });
      mockCtx.db.insert.mockResolvedValue("new_a1");

      const result = await createAuctionHandler(mockCtx, {
        ...validArgs,
        isDraft: true,
      });

      expect(result).toBe("new_a1");
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx,
        "auctions",
        "draft",
        1
      );
    });

    it("should create a pending_review auction successfully", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "cat1" });
      mockCtx.db.insert.mockResolvedValue("new_a2");

      const result = await createAuctionHandler(mockCtx, {
        ...validArgs,
        isDraft: false,
      });

      expect(result).toBe("new_a2");
      expect(adminUtils.updateCounter).toHaveBeenCalledWith(
        mockCtx,
        "auctions",
        "pending",
        1
      );
    });

    it("should throw error for invalid duration in createAuction", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      await expect(
        createAuctionHandler(mockCtx, { ...validArgs, durationDays: 0 })
      ).rejects.toThrow("Invalid duration");
    });

    it("should throw error for invalid categoryId in createAuction", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(createAuctionHandler(mockCtx, validArgs)).rejects.toThrow(
        "Invalid categoryId"
      );
    });
  });

  describe("saveDraft", () => {
    const validArgs = {
      title: "Title",
      categoryId: "cat1" as Id<"equipmentCategories">,
      make: "Make",
      model: "Model",
      year: 2020,
      operatingHours: 100,
      location: "Loc",
      description: "Desc",
      startingPrice: 1000,
      reservePrice: 2000,
      durationDays: 7,
      images: { front: "img1" },
      conditionChecklist: {
        engine: true,
        hydraulics: true,
        tires: true,
        serviceHistory: true,
      },
    };

    it("should save a new draft", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as any);
      mockCtx.db.insert.mockResolvedValue("new_a1");

      const result = await saveDraftHandler(mockCtx, validArgs);

      expect(result).toBe("new_a1");
    });

    it("should update an existing draft", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as any);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u1",
        status: "draft",
      });

      const result = await saveDraftHandler(mockCtx, {
        ...validArgs,
        auctionId: "a1",
      });

      expect(result).toBe("a1");
      expect(mockCtx.db.patch).toHaveBeenCalled();
    });

    it("should throw error if auction not found in saveDraft", async () => {
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId: "u1",
      } as any);
      mockCtx.db.get.mockResolvedValue(null);

      await expect(
        saveDraftHandler(mockCtx, { ...validArgs, auctionId: "a1" })
      ).rejects.toThrow("Auction not found");
    });
  });
});
