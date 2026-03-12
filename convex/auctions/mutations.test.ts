import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "../lib/auth";
import {
  createAuctionHandler,
  saveDraftHandler,
  generateUploadUrlHandler,
  deleteUploadHandler,
  bulkUpdateAuctionsHandler,
} from "./mutations";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// helper types for mocking
type CreateArgs = Parameters<typeof createAuctionHandler>[1];

const createMockProfile = (
  userId: string,
  role: "buyer" | "seller" | "admin" = "buyer"
): Doc<"profiles"> => ({
  _id: ("p_" + userId) as Id<"profiles">,
  _creationTime: Date.now(),
  userId,
  role,
  isVerified: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

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

interface MockCtxType {
  db: {
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
    system: unknown;
    normalizeId: ReturnType<typeof vi.fn>;
  };
  storage: {
    generateUploadUrl: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getUrl: ReturnType<typeof vi.fn>;
  };
}

describe("Mutations Coverage", () => {
  let mockCtx: MockCtxType;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        replace: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
          collect: vi.fn().mockResolvedValue([]),
          normalizeId: vi.fn((_table: string, id: string) => id),
        })),
        system: {},
        normalizeId: vi.fn((_table: string, id: string) => id),
      },
      storage: {
        generateUploadUrl: vi.fn(),
        delete: vi.fn().mockResolvedValue(undefined),
        getUrl: vi.fn().mockResolvedValue("http://url"),
      },
    };
  });

  describe("createAuctionHandler", () => {
    const validArgs: CreateArgs = {
      title: "Test",
      categoryId: "cat1" as Id<"equipmentCategories">,
      make: "Make",
      model: "Model",
      year: 2020,
      operatingHours: 100,
      location: "Loc",
      description: "desc",
      startingPrice: 1000,
      reservePrice: 2000,
      durationDays: 7,
      images: { front: "img1", additional: [] },
      conditionChecklist: {
        engine: true,
        hydraulics: true,
        tires: true,
        serviceHistory: true,
      },
    };

    it("should create auction successfully", async () => {
      const userId = "u1";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        profile: createMockProfile(userId, "seller"),
        userId,
      });
      mockCtx.db.get.mockResolvedValue({
        _id: "cat1",
        name: "Equipment",
      } as Doc<"equipmentCategories">);

      const result = await createAuctionHandler(
        mockCtx as unknown as MutationCtx,
        validArgs
      );

      expect(result).toBe("id123");
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "auctions",
        expect.objectContaining({
          title: "Test",
          status: "pending_review",
        })
      );
    });

    it("should throw if category not found", async () => {
      const userId = "u1";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId,
        profile: createMockProfile(userId),
      });
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        createAuctionHandler(mockCtx as unknown as MutationCtx, validArgs)
      ).rejects.toThrow("Category not found");
    });
  });

  describe("saveDraftHandler", () => {
    const draftArgs = {
      title: "Draft",
      categoryId: "cat1" as Id<"equipmentCategories">,
      make: "Make",
      model: "Model",
      year: 2020,
      operatingHours: 100,
      location: "Loc",
      description: "desc",
      startingPrice: 0,
      reservePrice: 0,
      durationDays: 1,
      images: { additional: [] },
      conditionChecklist: {
        engine: true,
        hydraulics: true,
        tires: true,
        serviceHistory: true,
      },
    };

    it("should save new draft", async () => {
      const userId = "u1";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        profile: createMockProfile(userId, "seller"),
        userId,
      });

      const result = await saveDraftHandler(
        mockCtx as unknown as MutationCtx,
        draftArgs
      );

      expect(result).toBe("id123");
    });

    it("should update existing draft", async () => {
      const userId = "u1";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        profile: createMockProfile(userId, "seller"),
        userId,
      });
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u1",
        status: "draft",
      } as Doc<"auctions">);

      const result = await saveDraftHandler(mockCtx as unknown as MutationCtx, {
        ...draftArgs,
        auctionId: "a1" as Id<"auctions">,
        title: "Updated",
      });

      expect(result).toBe("a1");
    });

    it("should throw if auction not found", async () => {
      const userId = "u1";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId,
        profile: createMockProfile(userId),
      });
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        saveDraftHandler(mockCtx as unknown as MutationCtx, {
          ...draftArgs,
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Auction not found");
    });

    it("should throw if not owner", async () => {
      const userId = "u1";
      vi.mocked(auth.requireVerified).mockResolvedValue({
        userId,
        profile: createMockProfile(userId),
      });
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        sellerId: "u2",
        status: "draft",
      } as Doc<"auctions">);
      await expect(
        saveDraftHandler(mockCtx as unknown as MutationCtx, {
          ...draftArgs,
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("You can only modify your own auctions");
    });
  });

  describe("generateUploadUrl and deleteUpload", () => {
    it("should generate upload url", async () => {
      mockCtx.storage.generateUploadUrl.mockResolvedValue("url123");
      const result = await generateUploadUrlHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(result).toBe("url123");
    });

    it("should delete storage item", async () => {
      mockCtx.storage.getUrl.mockResolvedValue("https://example.com/file");
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockCtx.db.get.mockResolvedValue({
        _id: "a1",
        status: "pending_review",
      } as Doc<"auctions">);

      const result = await bulkUpdateAuctionsHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionIds: ["a1" as Id<"auctions">],
          updates: {
            status: "active",
            startTime: Date.now(),
            endTime: Date.now() + 10000,
          },
        }
      );

      expect(result.updated).toContain("a1");
    });

    it("should handle missing auctions in bulk update", async () => {
      vi.mocked(auth.requireAdmin).mockResolvedValue({
        ...createMockProfile("admin", "admin"),
        userId: "admin",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      mockCtx.db.get.mockResolvedValue(null);
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
