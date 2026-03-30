import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import { MS_PER_DAY } from "../../constants";
import {
  updateAuctionHandler,
  adminUpdateAuctionHandler,
  bulkUpdateAuctionsHandler,
  updateConditionReportHandler,
} from "./update";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

// helper types for mocking
interface MockCtxType {
  db: {
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    normalizeId: ReturnType<typeof vi.fn>;
  };
  storage: {
    generateUploadUrl: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getUrl: ReturnType<typeof vi.fn>;
  };
}

let mockCtx: MockCtxType;

vi.mock("../../lib/auth", () => {
  return {
    getAuthenticatedUserId: vi.fn(),
    requireAdmin: vi.fn(),
    requireAuth: vi.fn(),
    requireVerified: vi.fn(),
  };
});

vi.mock("../../admin_utils", () => ({
  updateCounter: vi.fn(),
  adjustStatusCounters: vi.fn(),
  logAudit: vi.fn(),
}));

const createMockProfile = (userId: string, role: string) => ({
  userId,
  role,
  _id: "p1" as Id<"profiles">,
  _creationTime: Date.now(),
  isVerified: role === "verified" || role === "admin",
});

describe("Update Mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn().mockResolvedValue("id"),
        patch: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(),
        normalizeId: vi.fn().mockImplementation((_table, id) => id),
      },
      storage: {
        generateUploadUrl: vi.fn().mockResolvedValue("url"),
        delete: vi.fn().mockResolvedValue(undefined),
        getUrl: vi.fn().mockResolvedValue("url"),
      },
    };

    // Default auth mocks
    vi.mocked(auth.requireAuth).mockResolvedValue({
      userId: "u1",
      _id: "u1",
    } as {
      userId: string;
      _id: string;
    });
    vi.mocked(auth.requireVerified).mockResolvedValue({
      userId: "u1",
      profile: createMockProfile("u1", "verified") as Doc<"profiles">,
    });
  });

  describe("updateAuctionHandler", () => {
    const updateArgs = {
      auctionId: "a1" as Id<"auctions">,
      updates: {
        title: "Updated Title",
        startingPrice: 5000,
      },
    };

    it("should update auction successfully", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        images: { front: "img1" },
      } as Doc<"auctions">);

      const result = await updateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        updateArgs
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          title: "Updated Title",
          currentPrice: 5000,
        })
      );
    });

    it("should handle array-based image conversion", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        images: ["img1", "img2"], // Legacy array format
      } as unknown as Doc<"auctions">);

      const result = await updateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          updates: { title: "New", images: {} },
        }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          images: expect.objectContaining({
            front: "img1",
            additional: ["img2"],
          }),
        })
      );
    });

    it("should handle empty array-based image conversion", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        images: [],
      } as unknown as Doc<"auctions">);

      const result = await updateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          updates: { title: "New", images: { front: "new-img" } },
        }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          images: { front: "new-img" },
        })
      );
    });

    it("should handle object-based image update", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        images: { front: "old-img" },
      } as unknown as Doc<"auctions">);

      const result = await updateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          updates: { images: { engine: "engine-img" } },
        }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          images: { front: "old-img", engine: "engine-img" },
        })
      );
    });

    it("should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, updateArgs)
      ).rejects.toThrow("Auction not found");
    });

    it("should throw if not owner", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "other_user",
        status: "draft",
      } as Doc<"auctions">);

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, updateArgs)
      ).rejects.toThrow("You can only modify your own auctions");
    });

    it("should throw if not editable", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "active",
      } as Doc<"auctions">);

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, updateArgs)
      ).rejects.toThrow("Only draft or pending_review auctions can be edited");
    });

    it("should throw if too many additional images", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        images: { additional: ["1", "2", "3"] },
      } as Doc<"auctions">);

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: {
            images: { additional: ["1", "2", "3", "4", "5", "6", "7"] },
          },
        })
      ).rejects.toThrow("Additional images limit exceeded");
    });

    it("should throw if invalid durationDays", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
      } as Doc<"auctions">);

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { durationDays: 0 },
        })
      ).rejects.toThrow("Invalid duration");
    });

    it("should validate pending_review auction update", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "pending_review",
        title: "T",
        description: "D",
        startingPrice: 100,
        reservePrice: 200,
        images: { front: "img1" },
      } as Doc<"auctions">);

      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { title: "" },
        })
      ).rejects.toThrow("Title is required");
    });
  });

  describe("adminUpdateAuctionHandler", () => {
    it("should update auction as admin", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "draft" });

      const result = await adminUpdateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          updates: { title: "New Title" },
        }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        title: "New Title",
      });
    });

    it("should validate if status is set to active", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "pending_review" });

      // Should throw because endTime is missing in the merged state
      await expect(
        adminUpdateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { status: "active" },
        })
      ).rejects.toThrow("Cannot set status to 'active' without endTime");
    });

    it("should reset hiddenByFlags when status changes from pending_review", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "pending_review" });
      await adminUpdateAuctionHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
        updates: { status: "active", endTime: Date.now() + 1000 },
      });
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          hiddenByFlags: false,
        })
      );
    });

    it("should throw if auction not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        adminUpdateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { title: "New" },
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should reject startTime 2 years in the past for non-draft", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "pending_review" });
      const pastTime = Date.now() - 2 * 365 * MS_PER_DAY;
      await expect(
        adminUpdateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { startTime: pastTime },
        })
      ).rejects.toThrow("cannot be more than 1 year in the past");
    });

    it("should reject startTime 11 years in the future for non-draft", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "pending_review" });
      const futureTime = Date.now() + 11 * 365 * MS_PER_DAY;
      await expect(
        adminUpdateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { startTime: futureTime },
        })
      ).rejects.toThrow("cannot be more than 10 years in the future");
    });

    it("should accept startTime 5 years in the future for non-draft", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "pending_review" });
      const futureTime = Date.now() + 5 * 365 * MS_PER_DAY;
      const result = await adminUpdateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          updates: { startTime: futureTime },
        }
      );
      expect(result.success).toBe(true);
    });
  });

  describe("bulkUpdateAuctionsHandler", () => {
    it("should update multiple auctions", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        title: "Test",
        sellerId: "u1",
      });

      const result = await bulkUpdateAuctionsHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionIds: ["a1" as Id<"auctions">],
          updates: { status: "active", endTime: Date.now() + 100000 },
        }
      );
      expect(result.updated).toContain("a1");
    });

    it("should handle missing auctions in bulk update", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      const result = await bulkUpdateAuctionsHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionIds: ["a1" as Id<"auctions">],
          updates: { status: "active", endTime: Date.now() + 100000 },
        }
      );
      expect(result.skipped).toContain("a1");
    });

    it("should throw if bulk update size exceeded", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      const ids = Array(51).fill("a1" as Id<"auctions">);
      await expect(
        bulkUpdateAuctionsHandler(mockCtx as unknown as MutationCtx, {
          auctionIds: ids,
          updates: { status: "active" },
        })
      ).rejects.toThrow("Bulk update exceeds limit");
    });

    it("should skip auctions with invalid startTime in bulk update", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        title: "Test",
        sellerId: "u1",
      });
      const pastTime = Date.now() - 2 * 365 * MS_PER_DAY;
      const result = await bulkUpdateAuctionsHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionIds: ["a1" as Id<"auctions">],
          updates: { startTime: pastTime },
        }
      );
      expect(result.skipped).toContain("a1");
      expect(result.updated).not.toContain("a1");
    });
  });

  describe("updateConditionReportHandler", () => {
    it("should update condition report", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
      });

      const result = await updateConditionReportHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          storageId: "s1" as Id<"_storage">,
        }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        conditionReportUrl: "s1",
      });
    });

    it("should delete old report if exists", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        conditionReportUrl: "old-s",
      });

      await updateConditionReportHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
        storageId: "new-s" as Id<"_storage">,
      });
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("old-s");
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        conditionReportUrl: "new-s",
      });
    });
  });
});
