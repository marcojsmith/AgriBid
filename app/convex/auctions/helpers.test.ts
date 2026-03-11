/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { resolveImageUrls, toAuctionSummary, toAuctionDetail } from "./helpers";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// Mock the image_cache module
vi.mock("../image_cache", () => ({
  resolveUrlCached: vi.fn((_storage: any, id?: string) => {
    if (!id) return Promise.resolve(undefined);
    return Promise.resolve(`https://example.com/images/${id}`);
  }),
}));

// Mock the users module
vi.mock("../users", () => ({
  findUserById: vi.fn((_ctx: any, userId: string) => {
    if (userId === "seller_123") {
      return Promise.resolve({
        _id: "seller_123",
        email: "seller@example.com",
        name: "Test Seller",
        createdAt: Date.now(),
      });
    }
    return Promise.resolve(null);
  }),
}));

describe("resolveImageUrls", () => {
  let mockStorage: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockStorage = {};
  });

  it("should resolve object format images", async () => {
    const images = {
      front: "img_front",
      engine: "img_engine",
      cabin: "img_cabin",
      rear: "img_rear",
      additional: ["img_add1", "img_add2"],
    };

    const result = await resolveImageUrls(mockStorage, images);

    expect(result.front).toBe("https://example.com/images/img_front");
    expect(result.engine).toBe("https://example.com/images/img_engine");
    expect(result.cabin).toBe("https://example.com/images/img_cabin");
    expect(result.rear).toBe("https://example.com/images/img_rear");
    expect(result.additional).toHaveLength(2);
    expect(result.additional[0]).toBe("https://example.com/images/img_add1");
  });

  it("should handle legacy array format", async () => {
    const images = ["img1", "img2", "img3"];

    const result = await resolveImageUrls(mockStorage, images);

    expect(result.front).toBeUndefined();
    expect(result.engine).toBeUndefined();
    expect(result.cabin).toBeUndefined();
    expect(result.rear).toBeUndefined();
    expect(result.additional).toHaveLength(3);
  });

  it("should handle empty object", async () => {
    const images = {};

    const result = await resolveImageUrls(mockStorage, images);

    expect(result.front).toBeUndefined();
    expect(result.engine).toBeUndefined();
    expect(result.cabin).toBeUndefined();
    expect(result.rear).toBeUndefined();
    expect(result.additional).toEqual([]);
  });

  it("should filter out invalid image IDs", async () => {
    const images = {
      front: "",
      engine: "valid_id",
      additional: ["", "valid_id", null as any, undefined as any],
    };

    const result = await resolveImageUrls(mockStorage, images);

    expect(result.front).toBeUndefined();
    expect(result.engine).toBe("https://example.com/images/valid_id");
    expect(result.additional).toHaveLength(1);
  });

  it("should apply limit to additional images", async () => {
    const images = {
      additional: ["img1", "img2", "img3", "img4", "img5"],
    };

    const result = await resolveImageUrls(mockStorage, images, { limit: 2 });

    expect(result.additional).toHaveLength(2);
  });

  it("should handle null or undefined input", async () => {
    const result1 = await resolveImageUrls(mockStorage, null);
    const result2 = await resolveImageUrls(mockStorage, undefined);

    expect(result1.additional).toEqual([]);
    expect(result2.additional).toEqual([]);
  });

  it("should handle non-object, non-array input", async () => {
    const result = await resolveImageUrls(mockStorage, "invalid" as any);

    expect(result.front).toBeUndefined();
    expect(result.additional).toEqual([]);
  });

  it("should filter out undefined URLs from resolved images", async () => {
    const { resolveUrlCached } = await import("../image_cache");
    vi.mocked(resolveUrlCached).mockImplementation(
      (_storage: any, id?: string) => {
        if (id === "valid") return Promise.resolve("https://example.com/valid");
        return Promise.resolve(undefined);
      }
    );

    const images = {
      additional: ["valid", "invalid"],
    };

    const result = await resolveImageUrls(mockStorage, images);

    expect(result.additional).toHaveLength(1);
    expect(result.additional[0]).toBe("https://example.com/valid");
  });
});

describe("toAuctionSummary", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (category: any = null) => {
    return {
      db: {
        get: vi.fn().mockResolvedValue(category),
      },
      storage: {},
    } as unknown as QueryCtx;
  };

  const createMockAuction = (): Doc<"auctions"> => ({
    _id: "auction_123" as any,
    _creationTime: Date.now(),
    title: "Test Auction",
    description: "Test description",
    make: "John Deere",
    model: "8R",
    year: 2020,
    currentPrice: 50000,
    startingPrice: 40000,
    minIncrement: 500,
    startTime: Date.now(),
    endTime: Date.now() + 86400000,
    durationDays: 7,
    status: "active",
    reservePrice: 45000,
    operatingHours: 1200,
    location: "Iowa, USA",
    categoryId: "cat_123" as any,
    sellerId: "seller_123",
    winnerId: undefined,
    conditionReportUrl: undefined,
    isExtended: false,
    seedId: undefined,
    images: {
      front: "img_front",
      engine: "img_engine",
      cabin: "img_cabin",
      rear: "img_rear",
      additional: ["img1", "img2"],
    },
    conditionChecklist: {
      engine: true,
      hydraulics: true,
      tires: true,
      serviceHistory: true,
    },
  });

  it("should transform auction to summary format", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category);
    const auction = createMockAuction();

    const result = await toAuctionSummary(mockCtx, auction);

    expect(result._id).toBe(auction._id);
    expect(result.title).toBe("Test Auction");
    expect(result.make).toBe("John Deere");
    expect(result.categoryName).toBe("Tractors");
    expect(result.images.front).toBeDefined();
  });

  it("should handle missing category", async () => {
    mockCtx = setupMockCtx(null);
    const auction = createMockAuction();

    const result = await toAuctionSummary(mockCtx, auction);

    expect(result.categoryName).toBe("Unknown");
  });

  it("should include all required fields", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category);
    const auction = createMockAuction();

    const result = await toAuctionSummary(mockCtx, auction);

    expect(result).toHaveProperty("_id");
    expect(result).toHaveProperty("_creationTime");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("make");
    expect(result).toHaveProperty("model");
    expect(result).toHaveProperty("year");
    expect(result).toHaveProperty("currentPrice");
    expect(result).toHaveProperty("startingPrice");
    expect(result).toHaveProperty("minIncrement");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("images");
  });

  it("should apply limit of 0 to additional images", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category);
    const auction = createMockAuction();

    const result = await toAuctionSummary(mockCtx, auction);

    expect(result.images.additional).toEqual([]);
  });
});

describe("toAuctionDetail", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (
    category: any = null,
    isAuthenticated: boolean = false
  ) => {
    return {
      db: {
        get: vi.fn().mockResolvedValue(category),
      },
      auth: {
        getUserIdentity: vi
          .fn()
          .mockResolvedValue(isAuthenticated ? { userId: "user_123" } : null),
      },
      storage: {},
    } as unknown as QueryCtx;
  };

  const createMockAuction = (): Doc<"auctions"> => ({
    _id: "auction_123" as any,
    _creationTime: Date.now(),
    title: "Test Auction",
    description: "Test description",
    make: "John Deere",
    model: "8R",
    year: 2020,
    currentPrice: 50000,
    startingPrice: 40000,
    minIncrement: 500,
    startTime: Date.now(),
    endTime: Date.now() + 86400000,
    durationDays: 7,
    status: "active",
    reservePrice: 45000,
    operatingHours: 1200,
    location: "Iowa, USA",
    categoryId: "cat_123" as any,
    sellerId: "seller_123",
    winnerId: undefined,
    conditionReportUrl: undefined,
    isExtended: false,
    seedId: undefined,
    images: {
      front: "img_front",
      engine: "img_engine",
      cabin: "img_cabin",
      rear: "img_rear",
      additional: ["img1", "img2"],
    },
    conditionChecklist: {
      engine: true,
      hydraulics: true,
      tires: true,
      serviceHistory: true,
    },
  });

  it("should transform auction to detail format with seller email for authenticated users", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category, true);
    const auction = createMockAuction();

    const result = await toAuctionDetail(mockCtx, auction);

    expect(result._id).toBe(auction._id);
    expect(result.title).toBe("Test Auction");
    expect(result.make).toBe("John Deere");
    expect(result.categoryName).toBe("Tractors");
    expect(result.sellerEmail).toBe("seller@example.com");
  });

  it("should not include seller email for unauthenticated users", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category, false);
    const auction = createMockAuction();

    const result = await toAuctionDetail(mockCtx, auction);

    expect(result.sellerEmail).toBeUndefined();
  });

  it("should handle missing category", async () => {
    mockCtx = setupMockCtx(null, true);
    const auction = createMockAuction();

    const result = await toAuctionDetail(mockCtx, auction);

    expect(result.categoryName).toBe("Unknown");
  });

  it("should include all required fields", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category, true);
    const auction = createMockAuction();

    const result = await toAuctionDetail(mockCtx, auction);

    expect(result).toHaveProperty("_id");
    expect(result).toHaveProperty("_creationTime");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("description");
    expect(result).toHaveProperty("make");
    expect(result).toHaveProperty("model");
    expect(result).toHaveProperty("year");
    expect(result).toHaveProperty("operatingHours");
    expect(result).toHaveProperty("location");
    expect(result).toHaveProperty("startingPrice");
    expect(result).toHaveProperty("reservePrice");
    expect(result).toHaveProperty("currentPrice");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("images");
  });

  it("should resolve all image slots including additional", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category, true);
    const auction = createMockAuction();

    const result = await toAuctionDetail(mockCtx, auction);

    expect(result.images.front).toBeDefined();
    expect(result.images.engine).toBeDefined();
    expect(result.images.cabin).toBeDefined();
    expect(result.images.rear).toBeDefined();
    expect(result.images.additional.length).toBeGreaterThan(0);
  });

  it("should handle seller not found gracefully", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category, true);
    const auction = createMockAuction();
    auction.sellerId = "nonexistent_seller";

    const result = await toAuctionDetail(mockCtx, auction);

    expect(result.sellerEmail).toBeUndefined();
  });
});
