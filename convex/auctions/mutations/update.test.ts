import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import {
  updateLotHandler,
  adminUpdateLotHandler,
  bulkUpdateLotsHandler,
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
        normalizeId: vi
          .fn()
          .mockImplementation((_table: string, id: string) => id),
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

  describe("updateLotHandler", () => {
    const updateArgs = {
      lotId: "a1" as Id<"lots">,
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
      } as Doc<"lots">);

      const result = await updateLotHandler(
        mockCtx as unknown as MutationCtx,
        updateArgs
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
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
      } as unknown as Doc<"lots">);

      const result = await updateLotHandler(mockCtx as unknown as MutationCtx, {
        lotId: "a1" as Id<"lots">,
        updates: { title: "New", images: {} },
      });

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          images: expect.objectContaining({
            front: "img1",
            additional: ["img2"],
          }) as unknown as Record<string, unknown>,
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
      } as unknown as Doc<"lots">);

      const result = await updateLotHandler(mockCtx as unknown as MutationCtx, {
        lotId: "a1" as Id<"lots">,
        updates: { title: "New", images: { front: "new-img" } },
      });

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
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
      } as unknown as Doc<"lots">);

      const result = await updateLotHandler(mockCtx as unknown as MutationCtx, {
        lotId: "a1" as Id<"lots">,
        updates: { images: { engine: "engine-img" } },
      });

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
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
        updateLotHandler(mockCtx as unknown as MutationCtx, updateArgs)
      ).rejects.toThrow("Lot not found");
    });

    it("should throw if not owner", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "other_user",
        status: "draft",
      } as Doc<"lots">);

      await expect(
        updateLotHandler(mockCtx as unknown as MutationCtx, updateArgs)
      ).rejects.toThrow("You can only modify your own lots");
    });

    it("should throw if not editable", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "assigned",
      } as Doc<"lots">);

      await expect(
        updateLotHandler(mockCtx as unknown as MutationCtx, updateArgs)
      ).rejects.toThrow("Only draft or pending_review lots can be edited");
    });

    it("should throw if too many additional images", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        images: { additional: ["1", "2", "3"] },
      } as Doc<"lots">);

      await expect(
        updateLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "a1" as Id<"lots">,
          updates: {
            images: { additional: ["1", "2", "3", "4", "5", "6", "7"] },
          },
        })
      ).rejects.toThrow("Additional images limit exceeded");
    });

    it("should validate pending_review lot update", async () => {
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
      } as Doc<"lots">);

      await expect(
        updateLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "a1" as Id<"lots">,
          updates: { title: "" },
        })
      ).rejects.toThrow("Title is required");
    });
  });

  describe("adminUpdateLotHandler", () => {
    it("should update auction as admin", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "draft" });

      const result = await adminUpdateLotHandler(
        mockCtx as unknown as MutationCtx,
        {
          lotId: "a1" as Id<"lots">,
          updates: { title: "New Title" },
        }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "a1", {
        title: "New Title",
      });
    });

    it("should update a lot's status as admin", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "pending_review" });

      const result = await adminUpdateLotHandler(
        mockCtx as unknown as MutationCtx,
        {
          lotId: "a1" as Id<"lots">,
          updates: { status: "approved" },
        }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({ status: "approved" })
      );
    });

    it("should reset hiddenByFlags when status changes from pending_review", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "pending_review" });
      await adminUpdateLotHandler(mockCtx as unknown as MutationCtx, {
        lotId: "a1" as Id<"lots">,
        updates: { status: "assigned" },
      });
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "lots",
        "a1",
        expect.objectContaining({
          hiddenByFlags: false,
        })
      );
    });

    it("should throw if lot not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        adminUpdateLotHandler(mockCtx as unknown as MutationCtx, {
          lotId: "a1" as Id<"lots">,
          updates: { title: "New" },
        })
      ).rejects.toThrow("Lot not found");
    });
  });

  describe("bulkUpdateLotsHandler", () => {
    it("should update multiple auctions", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        title: "Test",
        sellerId: "u1",
      });

      const result = await bulkUpdateLotsHandler(
        mockCtx as unknown as MutationCtx,
        {
          lotIds: ["a1" as Id<"lots">],
          updates: { status: "assigned" },
        }
      );
      expect(result.updated).toContain("a1");
    });

    it("should handle missing lots in bulk update", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      const result = await bulkUpdateLotsHandler(
        mockCtx as unknown as MutationCtx,
        {
          lotIds: ["a1" as Id<"lots">],
          updates: { status: "assigned" },
        }
      );
      expect(result.skipped).toContain("a1");
    });

    it("should throw if bulk update size exceeded", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      const ids = Array(51).fill("a1" as Id<"lots">) as Id<"lots">[];
      await expect(
        bulkUpdateLotsHandler(mockCtx as unknown as MutationCtx, {
          lotIds: ids,
          updates: { status: "assigned" },
        })
      ).rejects.toThrow("Bulk update exceeds limit");
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
          lotId: "a1" as Id<"lots">,
          storageId: "s1" as Id<"_storage">,
        }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "a1", {
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
        lotId: "a1" as Id<"lots">,
        storageId: "new-s" as Id<"_storage">,
      });
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("old-s");
      expect(mockCtx.db.patch).toHaveBeenCalledWith("lots", "a1", {
        conditionReportUrl: "new-s",
      });
    });
  });
});
