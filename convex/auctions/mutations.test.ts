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
  updateConditionReportHandler,
  deleteConditionReportHandler,
  flagAuctionHandler,
  dismissFlagHandler,
  approveAuctionHandler,
  rejectAuctionHandler,
  adminUpdateAuctionHandler,
  closeAuctionEarlyHandler,
} from "./mutations";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type SaveDraftArgs = Parameters<typeof saveDraftHandler>[1];
type PartialDraftArgs = Partial<SaveDraftArgs> & {
  title?: string;
  images?: { front?: string; additional?: string[] };
  auctionId?: Id<"auctions">;
  startingPrice?: number;
  durationDays?: number;
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

vi.mock("../lib/auth", () => {
  class UnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  }
  return {
    getAuthenticatedUserId: vi.fn(),
    requireAdmin: vi.fn(),
    requireAuth: vi.fn(),
    requireVerified: vi.fn(),
    getCallerRole: vi.fn(),
    getAuthUser: vi.fn(),
    resolveUserId: vi.fn(),
    UnauthorizedError,
  };
});

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

    it("should validate if not a draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "cat1" });

      const argsWithoutTitle = { ...validArgs, title: "", isDraft: false };
      await expect(
        createAuctionHandler(
          mockCtx as unknown as MutationCtx,
          argsWithoutTitle
        )
      ).rejects.toThrow("Title is required");
    });

    it("should throw if no images when not a draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "cat1" });

      const argsWithoutImages = { ...validArgs, images: {}, isDraft: false };
      await expect(
        createAuctionHandler(
          mockCtx as unknown as MutationCtx,
          argsWithoutImages
        )
      ).rejects.toThrow("At least one image is required");
    });

    it("should throw if description is empty when not a draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "cat1" });
      const args = { ...validArgs, description: "", isDraft: false };
      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, args)
      ).rejects.toThrow("Description is required");
    });

    it("should throw if startingPrice is <= 0 when not a draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "cat1" });
      const args = { ...validArgs, startingPrice: 0, isDraft: false };
      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, args)
      ).rejects.toThrow("Starting price must be greater than zero");
    });

    it("should throw if reservePrice is <= 0 when not a draft", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "cat1" });
      const args = { ...validArgs, reservePrice: 0, isDraft: false };
      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, args)
      ).rejects.toThrow("Reserve price must be greater than zero");
    });

    it("should throw if additional images limit exceeded", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      const args = {
        ...validArgs,
        images: { additional: ["1", "2", "3", "4", "5", "6", "7"] },
      };
      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, args)
      ).rejects.toThrow("Additional images limit exceeded (max 6)");
    });

    it("should throw if durationDays is invalid", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, {
          ...validArgs,
          durationDays: 0,
        })
      ).rejects.toThrow("Invalid duration");

      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, {
          ...validArgs,
          durationDays: 366,
        })
      ).rejects.toThrow("Invalid duration");
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

    it("should throw if durationDays is invalid", async () => {
      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            durationDays: 0,
            title: "Test",
            images: { front: "img1" },
          } as PartialDraftArgs as SaveDraftArgs
        )
      ).rejects.toThrow("Invalid duration");

      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            durationDays: 366,
            title: "Test",
            images: { front: "img1" },
          } as PartialDraftArgs as SaveDraftArgs
        )
      ).rejects.toThrow("Invalid duration");
    });

    it("should cap additional images to 6", async () => {
      const result = await saveDraftHandler(
        mockCtx as unknown as MutationCtx,
        {
          title: "Test",
          images: {
            additional: ["1", "2", "3", "4", "5", "6", "7"],
          },
        } as PartialDraftArgs as SaveDraftArgs
      );
      expect(result).toBe("id");
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auctions",
        expect.objectContaining({
          images: expect.objectContaining({
            additional: ["1", "2", "3", "4", "5", "6"],
          }),
        })
      );
    });

    it("should throw if invalid auctionId provided", async () => {
      mockCtx.db.normalizeId.mockReturnValue(null);
      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            auctionId: "invalid",
            title: "Test",
            images: { front: "img1" },
          } as PartialDraftArgs as SaveDraftArgs
        )
      ).rejects.toThrow("Invalid auctionId provided");
    });

    it("should throw if validAuctionId provided but auction missing", async () => {
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        saveDraftHandler(
          mockCtx as unknown as MutationCtx,
          {
            auctionId: "a1" as Id<"auctions">,
            title: "Test",
            images: { front: "img1" },
          } as PartialDraftArgs as SaveDraftArgs
        )
      ).rejects.toThrow("Auction not found");
    });

    it("should set minIncrement based on startingPrice", async () => {
      // < 10000
      await saveDraftHandler(
        mockCtx as unknown as MutationCtx,
        {
          title: "Test",
          startingPrice: 5000,
          images: { front: "img1" },
        } as PartialDraftArgs as SaveDraftArgs
      );
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auctions",
        expect.objectContaining({ minIncrement: 100 })
      );

      // >= 10000
      await saveDraftHandler(
        mockCtx as unknown as MutationCtx,
        {
          title: "Test",
          startingPrice: 15000,
          images: { front: "img1" },
        } as PartialDraftArgs as SaveDraftArgs
      );
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auctions",
        expect.objectContaining({ minIncrement: 500 })
      );
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
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      await deleteUploadHandler(mockCtx as unknown as MutationCtx, {
        storageId: "s1" as Id<"_storage">,
      });
      expect(mockCtx.storage.delete).toHaveBeenCalledWith("s1");
    });

    it("should warn if deleting non-existent storage item", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.storage.getUrl.mockResolvedValue(null);
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await deleteUploadHandler(mockCtx as unknown as MutationCtx, {
        storageId: "s1" as Id<"_storage">,
      });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
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

    it("should update successfully in bulk if validation passes", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
      });

      const result = await bulkUpdateAuctionsHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionIds: ["a1" as Id<"auctions">],
          updates: { status: "active", endTime: Date.now() + 1000 },
        }
      );

      expect(result.updated).toContain("a1");
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

      // Invalid update (e.g. title too short if that was a rule, but here let's just use empty)
      await expect(
        updateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { title: "" },
        })
      ).rejects.toThrow("Title is required");
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

    it("should handle array-based image validation in publish", async () => {
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
        images: ["img1"], // Legacy array format
      } as unknown as Doc<"auctions">);

      const result = await publishAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );

      expect(result.success).toBe(true);
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
        publishAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Only draft auctions can be published");
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

    it("should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        updateConditionReportHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          storageId: "s1" as Id<"_storage">,
        })
      ).rejects.toThrow("Auction not found");
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
    });

    it("should handle old report deletion failure gracefully", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: userId,
        status: "draft",
        conditionReportUrl: "old-s",
      });
      mockCtx.storage.delete.mockRejectedValue(new Error("Storage Error"));
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await updateConditionReportHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
        storageId: "new-s" as Id<"_storage">,
      });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
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
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await deleteConditionReportHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(true);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("flagAuctionHandler", () => {
    it("should flag auction", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: "u2" });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([]),
      });

      const result = await flagAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auctionFlags",
        expect.objectContaining({ reason: "misleading" })
      );
    });

    it("should allow flagging if others have flagged it", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: "u2" });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi
          .fn()
          .mockResolvedValue([{ reporterId: "other", status: "pending" }]),
      });

      const result = await flagAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        }
      );
      expect(result.success).toBe(true);
    });

    it("should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        flagAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should throw if flagging own auction", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: userId });
      await expect(
        flagAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        })
      ).rejects.toThrow("You cannot flag your own auction");
    });

    it("should throw if already flagged", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", sellerId: "u2" });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi
          .fn()
          .mockResolvedValue([{ reporterId: userId, status: "pending" }]),
      });
      await expect(
        flagAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        })
      ).rejects.toThrow("You have already flagged this auction");
    });

    it("should auto-hide if threshold reached", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u2",
        status: "active",
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { reporterId: "u3", status: "pending" },
          { reporterId: "u4", status: "pending" },
        ]),
      });

      const result = await flagAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        }
      );
      expect(result.hideTriggered).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        status: "pending_review",
        hiddenByFlags: true,
      });
    });

    it("should NOT auto-hide if threshold reached but not active", async () => {
      const userId = "u1";
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(userId);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u2",
        status: "pending_review", // not active
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { reporterId: "u3", status: "pending" },
          { reporterId: "u4", status: "pending" },
        ]),
      });

      const result = await flagAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        }
      );
      expect(result.hideTriggered).toBe(false);
    });
  });

  describe("dismissFlagHandler", () => {
    it("should dismiss flag", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("admin-id");
      mockCtx.db.get.mockResolvedValue({
        _id: "f1",
        status: "pending",
        auctionId: "a1",
        reason: "other",
      });

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("f1", {
        status: "dismissed",
      });
      expect(vi.mocked(auth.getAuthUser)).toHaveBeenCalled();
    });

    it("should throw if flag not found", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        dismissFlagHandler(mockCtx as unknown as MutationCtx, {
          flagId: "f1" as Id<"auctionFlags">,
        })
      ).rejects.toThrow("Flag not found");
    });

    it("should throw if flag missing auction", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("admin-id");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          status: "pending",
          auctionId: "a1",
          reason: "other",
        }) // flag
        .mockResolvedValueOnce(null); // auction

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        {
          flagId: "f1" as Id<"auctionFlags">,
        }
      );
      expect(result.success).toBe(true);
      expect(result.auctionRestored).toBe(false);
    });

    it("should handle unknown admin in dismissFlagHandler", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      mockCtx.db.get.mockResolvedValue({
        _id: "f1",
        status: "pending",
        auctionId: "a1",
        reason: "other",
      });

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.success).toBe(true);
      expect(vi.mocked(auth.getAuthUser)).toHaveBeenCalled();
    });

    it("should restore auction if flags below threshold", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          status: "pending",
          auctionId: "a1",
          reason: "other",
        }) // flag
        .mockResolvedValueOnce({
          _id: "a1",
          status: "pending_review",
          hiddenByFlags: true,
        }); // auction

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([]), // no more pending flags
      });

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.auctionRestored).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("a1", {
        status: "active",
        hiddenByFlags: false,
      });
    });

    it("should NOT restore auction if flags still at threshold", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          status: "pending",
          auctionId: "a1",
          reason: "other",
        }) // flag
        .mockResolvedValueOnce({
          _id: "a1",
          status: "pending_review",
          hiddenByFlags: true,
        }); // auction

      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi
          .fn()
          .mockResolvedValue([
            { status: "pending" },
            { status: "pending" },
            { status: "pending" },
          ]), // still 3 flags
      });

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.auctionRestored).toBe(false);
    });

    it("should not restore auction if status is not pending_review", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          status: "pending",
          auctionId: "a1",
          reason: "other",
        }) // flag
        .mockResolvedValueOnce({
          _id: "a1",
          status: "active",
          hiddenByFlags: true,
        }); // not pending_review

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.auctionRestored).toBe(false);
    });

    it("should not restore auction if not hiddenByFlags", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          status: "pending",
          auctionId: "a1",
          reason: "other",
        }) // flag
        .mockResolvedValueOnce({
          _id: "a1",
          status: "pending_review",
          hiddenByFlags: false,
        }); // not hidden

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        { flagId: "f1" as Id<"auctionFlags"> }
      );
      expect(result.auctionRestored).toBe(false);
    });

    it("should throw if not admin", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("user");
      await expect(
        dismissFlagHandler(mockCtx as unknown as MutationCtx, {
          flagId: "f1" as Id<"auctionFlags">,
        })
      ).rejects.toThrow("Admin privileges required");
    });

    it("should throw if flag already reviewed", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get.mockResolvedValue({ status: "dismissed" });
      await expect(
        dismissFlagHandler(mockCtx as unknown as MutationCtx, {
          flagId: "f1" as Id<"auctionFlags">,
        })
      ).rejects.toThrow("Flag has already been reviewed");
    });
  });

  describe("approveAuctionHandler", () => {
    it("should approve auction", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
        durationDays: 7,
      });

      const result = await approveAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "active",
        })
      );
    });

    it("should throw if auction not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        approveAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should fallback to auction.durationDays then 7", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);

      // Fallback to auction.durationDays
      mockCtx.db.get.mockResolvedValueOnce({
        status: "pending_review",
        durationDays: 14,
      });
      await approveAuctionHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          endTime: expect.any(Number),
        })
      );

      // Fallback to 7
      mockCtx.db.get.mockResolvedValueOnce({
        status: "pending_review",
      });
      await approveAuctionHandler(mockCtx as unknown as MutationCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(mockCtx.db.patch).toHaveBeenCalled();
    });

    it("should throw if invalid durationDays", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        status: "pending_review",
      });
      await expect(
        approveAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          durationDays: 400,
        })
      ).rejects.toThrow("Invalid duration");
    });
  });

  describe("rejectAuctionHandler", () => {
    it("should reject auction", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
      });

      const result = await rejectAuctionHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({
          status: "rejected",
        })
      );
    });

    it("should throw if auction not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        rejectAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
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

    it("should handle unmapped status transition in adjustStatusCounters", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "rejected" });

      // Transition from rejected to sold (both unmapped in statusToCounterKey)
      const result = await adminUpdateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          updates: { status: "sold" },
        }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({ status: "sold" })
      );
    });

    it("should handle status transition from pending_review to rejected", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "pending_review" });

      const result = await adminUpdateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          updates: { status: "rejected" },
        }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({ status: "rejected" })
      );
    });

    it("should handle status transition from rejected to active", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ _id: "a1", status: "rejected" });

      const result = await adminUpdateAuctionHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
          updates: { status: "active", endTime: Date.now() + 1000 },
        }
      );
      expect(result.success).toBe(true);
      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({ status: "active" })
      );
    });
  });

  describe("closeAuctionEarlyHandler", () => {
    it("should close auction and determine winner", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 1000,
        title: "Test",
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { amount: 1500, bidderId: "u2", status: "valid", timestamp: 100 },
          { amount: 1200, bidderId: "u3", status: "valid", timestamp: 110 },
        ]),
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(true);
      expect(result.finalStatus).toBe("sold");
      expect(result.winnerId).toBe("u2");
      expect(result.winningAmount).toBe(1500);
    });

    it("should close as unsold if no bids", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 1000,
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([]),
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.finalStatus).toBe("unsold");
    });

    it("should handle same amount bids by timestamp", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "active",
        reservePrice: 1000,
      });
      mockCtx.db.query.mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        collect: vi.fn().mockResolvedValue([
          { amount: 1500, bidderId: "u2", status: "valid", timestamp: 120 },
          { amount: 1500, bidderId: "u3", status: "valid", timestamp: 110 },
        ]),
      });

      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.winnerId).toBe("u3"); // earlier timestamp
    });

    it("should return error if not authorized (via Error message)", async () => {
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

    it("should return error if not authorized (via generic Error)", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthenticated");
    });

    it("should throw if not a specialized Error in closeAuctionEarly", async () => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(
        new TypeError("Type Error")
      );
      await expect(
        closeAuctionEarlyHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Type Error");
    });

    it("should return error if auction not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe("Auction not found");
    });

    it("should return error if auction not active", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue({ status: "sold" });
      const result = await closeAuctionEarlyHandler(
        mockCtx as unknown as MutationCtx,
        { auctionId: "a1" as Id<"auctions"> }
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("already been settled");
    });
  });

  describe("Additional Branch Coverage", () => {
    it("saveDraftHandler (new draft) should increment draft counter", async () => {
      const { updateCounter } = await import("../admin_utils");
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");

      await saveDraftHandler(
        mockCtx as unknown as MutationCtx,
        {
          title: "New Draft",
          images: { front: "img1" },
        } as unknown as SaveDraftArgs
      );

      expect(updateCounter).toHaveBeenCalledWith(
        expect.anything(),
        "auctions",
        "draft",
        1
      );
    });

    it("deleteDraftHandler should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        deleteDraftHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("flagAuctionHandler should throw if auction not found", async () => {
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("u1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        flagAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          reason: "misleading",
        })
      ).rejects.toThrow("Auction not found");
    });

    it("dismissFlagHandler should handle missing auction when flag exists", async () => {
      vi.mocked(auth.getCallerRole).mockResolvedValue("admin");
      mockCtx.db.get
        .mockResolvedValueOnce({
          _id: "f1",
          auctionId: "a1",
          status: "pending",
        }) // flag
        .mockResolvedValueOnce(null); // auction missing

      const result = await dismissFlagHandler(
        mockCtx as unknown as MutationCtx,
        {
          flagId: "f1" as Id<"auctionFlags">,
        }
      );
      expect(result.success).toBe(true);
      expect(result.auctionRestored).toBe(false);
    });

    it("approveAuctionHandler should throw if auction not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        approveAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("rejectAuctionHandler should throw if auction not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        rejectAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("adminUpdateAuctionHandler should throw if auction not found", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({} as Doc<"profiles">);
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        adminUpdateAuctionHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
          updates: { title: "New" },
        })
      ).rejects.toThrow("Auction not found");
    });
  });
});
