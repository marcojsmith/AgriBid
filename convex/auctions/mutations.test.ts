import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../lib/auth";
import {
  createAuctionHandler,
  saveDraftHandler,
  generateUploadUrlHandler,
  deleteUploadHandler,
  bulkUpdateAuctionsHandler,
  updateAuctionHandler,
  publishAuctionHandler,
  deleteDraftHandler,
} from "./mutations";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type SaveDraftArgs = Parameters<typeof saveDraftHandler>[1];
type PartialDraftArgs = Partial<SaveDraftArgs> & {
  title?: string;
  images?: { front?: string };
  auctionId?: Id<"auctions">;
};

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
  auth: {
    getUserIdentity: ReturnType<typeof vi.fn>;
  };
}

let mockCtx: MockCtxType;

vi.mock("../lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
  requireAdmin: vi.fn(),
  requireAuth: vi.fn(),
  requireVerified: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
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

describe("Mutations Coverage", () => {
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
      auth: {
        getUserIdentity: vi.fn(),
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

  describe("createAuctionHandler", () => {
    const validArgs = {
      title: "Test",
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

    it("should create auction successfully", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "cat1" });

      const result = await createAuctionHandler(
        mockCtx as unknown as MutationCtx,
        validArgs
      );
      expect(result).toBeDefined();
      expect(mockCtx.db.insert).toHaveBeenCalled();
    });

    it("should throw if category not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, validArgs)
      ).rejects.toThrow("Category not found");
    });
  });

  describe("saveDraftHandler", () => {
    it("should save new draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      const result = await saveDraftHandler(
        mockCtx as unknown as MutationCtx,
        {
          title: "T",
          images: { front: "img1" },
        } as PartialDraftArgs as SaveDraftArgs
      );
      expect(result).toBe("id");
    });

    it("should update existing draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u1",
        status: "draft",
      });
      const result = await saveDraftHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          title: "T",
          images: { front: "img1" },
        } as PartialDraftArgs as SaveDraftArgs
      );
      expect(result).toBe("a1");
    });

    it("should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            auctionId: "a1" as Id<"auctions">,
            title: "T",
            images: { front: "img1" },
          } as PartialDraftArgs as SaveDraftArgs
        )
      ).rejects.toThrow("Auction not found");
    });

    it("should throw if not owner", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u2",
        status: "draft",
      });
      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            auctionId: "a1" as Id<"auctions">,
            title: "T",
            images: { front: "img1" },
          } as PartialDraftArgs as SaveDraftArgs
        )
      ).rejects.toThrow("You can only modify your own auctions");
    });

    it("should validate pending_review draft before saving", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "pending_review",
      } as Doc<"auctions">);

      // Should fail because title is missing in this update
      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            auctionId: "a1" as Id<"auctions">,
            title: "",
            images: { front: "img1" },
          } as PartialDraftArgs as SaveDraftArgs
        )
      ).rejects.toThrow("Title is required before publishing");
    });
  });

  describe("Upload Handlers", () => {
    it("should generate upload url", async () => {
      const url = await generateUploadUrlHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(url).toBe("url");
    });

    it("should delete storage item", async () => {
      await deleteUploadHandler(mockCtx as unknown as MutationCtx, {
        storageId: "s1" as Id<"_storage">,
      });
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("s1");
    });
  });

  describe("bulkUpdateAuctionsHandler", () => {
    it("should update multiple auctions", async () => {
      const adminUserId = "admin";
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        ...createMockProfile(adminUserId, "admin"),
        userId: adminUserId,
      } as Doc<"profiles"> & { userId: string });
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        title: "Test",
        sellerId: "u1",
        categoryName: "Tractors",
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
      const adminUserId = "admin";
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        ...createMockProfile(adminUserId, "admin"),
        userId: adminUserId,
      } as Doc<"profiles"> & { userId: string });
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

    it("should skip if validation fails (missing endTime for active)", async () => {
      const adminUserId = "admin";
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        ...createMockProfile(adminUserId, "admin"),
        userId: adminUserId,
      } as Doc<"profiles"> & { userId: string });

      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        // missing endTime
      } as Doc<"auctions">);

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
  });

  describe("publishAuctionHandler", () => {
    it("should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        publishAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should publish draft successfully", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        title: "Title",
        description: "Desc",
        startingPrice: 100,
        reservePrice: 200,
        images: { front: "img1" },
      } as Doc<"auctions">);

      const result = await publishAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        status: "pending_review",
      });
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

      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

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
  });
});
