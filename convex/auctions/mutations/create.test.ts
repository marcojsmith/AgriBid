import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../../lib/auth";
import { updateCounter } from "../../admin_utils";
import {
  createAuctionHandler,
  saveDraftHandler,
  generateUploadUrlHandler,
} from "./create";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

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

describe("Create Mutations", () => {
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

    it("should truncate additional images in saveDraftHandler", async () => {
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

    it("should increment draft counter for new draft", async () => {
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
  });

  describe("generateUploadUrlHandler", () => {
    it("should generate upload url", async () => {
      const url = await generateUploadUrlHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(url).toBe("url");
    });
  });
});
