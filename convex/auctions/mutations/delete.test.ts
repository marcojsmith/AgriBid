import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import {
  deleteUploadHandler,
  deleteDraftHandler,
  deleteConditionReportHandler,
} from "./delete";
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

describe("Delete Mutations", () => {
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

  describe("deleteUploadHandler", () => {
    it("should delete storage item", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      await deleteUploadHandler(mockCtx as unknown as MutationCtx, {
        storageId: "s1" as Id<"_storage">,
      });
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("s1");
    });

    it("should warn if deleting non-existent storage item", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.storage.getUrl.mockResolvedValue(null);
      const spy = vi.spyOn(console, "warn").mockImplementation(vi.fn());
      await deleteUploadHandler(mockCtx as unknown as MutationCtx, {
        storageId: "s1" as Id<"_storage">,
      });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("deleteDraftHandler", () => {
    it("should delete draft successfully", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        images: { front: "img1" },
      } as Doc<"auctions">);

      const result = await deleteDraftHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.delete).toHaveBeenCalledWith("a1");
    });

    it("should throw if not draft", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "active",
      } as Doc<"auctions">);

      await expect(
        deleteDraftHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only draft auctions can be deleted");
    });

    it("should handle condition report deletion failure gracefully", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        conditionReportUrl: "ref1",
      } as Doc<"auctions">);
      mockCtx.storage.delete.mockRejectedValue(new Error("Storage Error"));

      const spy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      const result = await deleteDraftHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.delete).toHaveBeenCalledWith("a1");
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to delete condition report"),
        expect.anything()
      );
      spy.mockRestore();
    });

    it("should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        deleteDraftHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });
  });

  describe("deleteConditionReportHandler", () => {
    it("should delete condition report", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        conditionReportUrl: "s1",
      });

      const result = await deleteConditionReportHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("s1");
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        conditionReportUrl: undefined,
      });
    });

    it("should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        deleteConditionReportHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should warn if delete fails", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        conditionReportUrl: "s1",
      });
      mockCtx.storage.delete.mockRejectedValue(new Error("Storage Error"));
      const spy = vi.spyOn(console, "warn").mockImplementation(vi.fn());

      const result = await deleteConditionReportHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(true);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
