import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  resolveImageUrls,
  toLotSummary,
  toLotDetail,
  toLotSummaries,
  resolveLotPhotos,
} from "./helpers";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const viewer = vi.hoisted(() => ({
  current: null as null | {
    userId: string;
    authUser: { _id: string };
    profile: { role: string } | null;
  },
}));

vi.mock("../lib/auth", () => ({
  getAuthWithProfile: vi.fn(() => Promise.resolve(viewer.current)),
}));
const fees = vi.hoisted(() => ({
  active: [] as { feeType: string; appliesTo: string; value: number }[],
}));

vi.mock("../lib/buyerPremium", () => ({
  isBuyerPercentageFee: (fee: { feeType: string; appliesTo: string }) =>
    fee.feeType === "percentage" &&
    (fee.appliesTo === "buyer" || fee.appliesTo === "both"),
  percentToFraction: (pct: number) => Math.round(pct * 100) / 10000,
  resolveBuyerPremium: vi.fn(() =>
    Promise.resolve({ source: "snapshot", rate: 0.12 })
  ),
}));
vi.mock("../admin/platformSettings", () => ({
  getBuyerPremiumPct: vi.fn(() => Promise.resolve(10)),
}));
vi.mock("../lib/lotCounters", () => ({
  getWatcherCount: vi.fn(() => Promise.resolve(3)),
  getBidCount: vi.fn(() => Promise.resolve(2)),
}));

// Mock the image_cache module
vi.mock("../image_cache", () => ({
  resolveUrlCached: vi.fn((_storage: unknown, id?: string) => {
    if (!id) return Promise.resolve(undefined);
    return Promise.resolve(`https://example.com/images/${id}`);
  }),
}));

describe("resolveImageUrls", () => {
  let mockStorage: QueryCtx["storage"];

  beforeEach(() => {
    vi.resetAllMocks();
    mockStorage = {} as QueryCtx["storage"];
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
      additional: [
        "",
        "valid_id",
        null as unknown as string,
        undefined as unknown as string,
      ],
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
    const result = await resolveImageUrls(mockStorage, "invalid");

    expect(result.front).toBeUndefined();
    expect(result.additional).toEqual([]);
  });

  it("should filter out undefined URLs from resolved images", async () => {
    const { resolveUrlCached } = await import("../image_cache");
    vi.mocked(resolveUrlCached).mockImplementation(
      (_storage: unknown, id?: string) => {
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

describe("toLotSummary", () => {
  let mockCtx: QueryCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (category: unknown = null) => {
    return {
      db: {
        get: vi.fn().mockResolvedValue(category),
      },
      storage: {},
    } as unknown as QueryCtx;
  };

  const createMockLot = (): Doc<"lots"> => ({
    _id: "lot_123" as Id<"lots">,
    _creationTime: Date.now(),
    title: "Test Auction",
    description: "Test description",
    make: "John Deere",
    model: "8R",
    year: 2020,
    currentPrice: 50000,
    startingPrice: 40000,
    minIncrement: 500,
    durationDays: 7,
    status: "assigned",
    reservePrice: 45000,
    operatingHours: 1200,
    location: "Iowa, USA",
    categoryId: "cat_123" as Id<"equipmentCategories">,
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
    const auction = createMockLot();

    const result = await toLotSummary(mockCtx, auction);

    expect(result._id).toBe(auction._id);
    expect(result.title).toBe("Test Auction");
    expect(result.make).toBe("John Deere");
    expect(result.categoryName).toBe("Tractors");
    expect(result.images.front).toBeDefined();
  });

  it("should handle missing category", async () => {
    mockCtx = setupMockCtx(null);
    const auction = createMockLot();

    const result = await toLotSummary(mockCtx, auction);

    expect(result.categoryName).toBe("Unknown");
  });

  it("should handle category found but missing name", async () => {
    mockCtx = setupMockCtx({ _id: "cat_123" });
    const auction = createMockLot();

    const result = await toLotSummary(mockCtx, auction);

    expect(result.categoryName).toBe("Unknown");
  });

  it("should include all required fields", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category);
    const auction = createMockLot();

    const result = await toLotSummary(mockCtx, auction);

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
    const auction = createMockLot();

    const result = await toLotSummary(mockCtx, auction);

    expect(result.images.additional).toEqual([]);
  });

  it("should include the parent auction window when the lot is assigned", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    const auctionDoc = {
      _id: "auction_1",
      title: "Spring Sale",
      startTime: 1000,
      endTime: 5000,
      status: "published",
    };
    mockCtx = {
      db: {
        get: vi.fn((table: string) =>
          Promise.resolve(table === "auctions" ? auctionDoc : category)
        ),
      },
      storage: {},
    } as unknown as QueryCtx;
    const lot = createMockLot();
    lot.auctionId = "auction_1" as Id<"auctions">;
    lot.extendedEndTime = 8000;

    const result = await toLotSummary(mockCtx, lot);

    expect(result.auctionId).toBe("auction_1");
    expect(result.auctionStartTime).toBe(1000);
    expect(result.auctionEndTime).toBe(5000);
    expect(result.auctionStatus).toBe("published");
    expect(result.extendedEndTime).toBe(8000);
  });
});

describe("toLotDetail", () => {
  let mockCtx: QueryCtx;

  beforeEach(() => {
    vi.clearAllMocks();
    viewer.current = null;
  });

  const setupMockCtx = (
    category: unknown = null,
    isAuthenticated = false,
    sellerProfile: unknown = null
  ) => {
    return {
      db: {
        get: vi.fn().mockResolvedValue(category),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(sellerProfile),
          collect: vi
            .fn()
            .mockImplementation(() => Promise.resolve(fees.active)),
        })),
      },
      auth: {
        getUserIdentity: vi
          .fn()
          .mockResolvedValue(isAuthenticated ? { userId: "user_123" } : null),
      },
      storage: {},
    } as unknown as QueryCtx;
  };

  const createMockSellerProfile = () => ({
    _id: "seller_123",
    userId: "seller_123",
    name: "Test Seller",
    email: "seller@example.com",
  });

  const createMockLot = (): Doc<"lots"> => ({
    _id: "lot_123" as Id<"lots">,
    _creationTime: Date.now(),
    title: "Test Auction",
    description: "Test description",
    make: "John Deere",
    model: "8R",
    year: 2020,
    currentPrice: 50000,
    startingPrice: 40000,
    minIncrement: 500,
    durationDays: 7,
    status: "assigned",
    reservePrice: 45000,
    operatingHours: 1200,
    location: "Iowa, USA",
    categoryId: "cat_123" as Id<"equipmentCategories">,
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

  it("should transform auction to detail format", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category, true, createMockSellerProfile());
    const auction = createMockLot();

    const result = await toLotDetail(mockCtx, auction);

    expect(result._id).toBe(auction._id);
    expect(result.title).toBe("Test Auction");
    expect(result.make).toBe("John Deere");
    expect(result.categoryName).toBe("Tractors");
    expect(result.bidCount).toBe(2);
    expect(result.watcherCount).toBe(3);
    expect(result.buyerPremiumFraction).toBe(0.12);
  });

  it("never returns the seller id, winner id or seller email", async () => {
    mockCtx = setupMockCtx(null, true, createMockSellerProfile());
    const result = await toLotDetail(mockCtx, {
      ...createMockLot(),
      winnerId: "winner_1",
    });

    expect(result).not.toHaveProperty("sellerId");
    expect(result).not.toHaveProperty("winnerId");
    expect(result).not.toHaveProperty("sellerEmail");
  });

  it("hides the reserve amount from buyers and signed-out visitors", async () => {
    mockCtx = setupMockCtx(null, false);
    viewer.current = null;
    const signedOut = await toLotDetail(mockCtx, createMockLot());
    viewer.current = {
      userId: "buyer_1",
      authUser: { _id: "auth_buyer_1" },
      profile: { role: "user" },
    };
    const buyer = await toLotDetail(mockCtx, createMockLot());

    for (const result of [signedOut, buyer]) {
      expect(result.reservePrice).toBeUndefined();
      expect(result.isSeller).toBe(false);
      expect(result.isWinner).toBe(false);
      // 2 bids at 50 000 against a 45 000 reserve.
      expect(result.reserveState).toBe("met");
    }
  });

  it("shows the reserve amount to the seller and to admins", async () => {
    mockCtx = setupMockCtx(null, true);
    viewer.current = {
      userId: "seller_123",
      authUser: { _id: "auth_seller_123" },
      profile: { role: "user" },
    };
    const seller = await toLotDetail(mockCtx, createMockLot());
    viewer.current = {
      userId: "admin_1",
      authUser: { _id: "auth_admin_1" },
      profile: { role: "admin" },
    };
    const admin = await toLotDetail(mockCtx, createMockLot());

    expect(seller.reservePrice).toBe(45000);
    expect(seller.isSeller).toBe(true);
    expect(admin.reservePrice).toBe(45000);
    expect(admin.isSeller).toBe(false);
  });

  it("flags the winner for the winning user only", async () => {
    mockCtx = setupMockCtx(null, true);
    const lot = { ...createMockLot(), winnerId: "winner_1" };
    viewer.current = {
      userId: "winner_1",
      authUser: { _id: "auth_winner_1" },
      profile: { role: "user" },
    };
    const winner = await toLotDetail(mockCtx, lot);
    viewer.current = {
      userId: "other",
      authUser: { _id: "auth_other" },
      profile: null,
    };
    const other = await toLotDetail(mockCtx, lot);

    expect(winner.isWinner).toBe(true);
    expect(other.isWinner).toBe(false);
  });

  it("falls back to the platform premium when the lot has no rate", async () => {
    const buyerPremium = await import("../lib/buyerPremium");
    vi.mocked(buyerPremium.resolveBuyerPremium).mockResolvedValueOnce({
      source: "feeRows",
      rate: undefined,
    });
    mockCtx = setupMockCtx(null, true);

    const result = await toLotDetail(mockCtx, createMockLot());

    expect(result.buyerPremiumFraction).toBe(0.1);
  });

  it("sums the active buyer percentage rows when they set the premium", async () => {
    const buyerPremium = await import("../lib/buyerPremium");
    vi.mocked(buyerPremium.resolveBuyerPremium).mockResolvedValueOnce({
      source: "feeRows",
      rate: undefined,
    });
    fees.active = [
      { feeType: "percentage", appliesTo: "buyer", value: 8 },
      { feeType: "percentage", appliesTo: "both", value: 2 },
      { feeType: "percentage", appliesTo: "seller", value: 5 },
      { feeType: "fixed", appliesTo: "buyer", value: 99 },
    ];
    mockCtx = setupMockCtx(null, true);

    const result = await toLotDetail(mockCtx, createMockLot());
    fees.active = [];

    expect(result.buyerPremiumFraction).toBe(0.1);
  });

  it("treats a seller stored under the auth user id as the seller", async () => {
    viewer.current = {
      userId: "someone",
      authUser: { _id: "seller_123" },
      profile: { role: "user" },
    };
    mockCtx = setupMockCtx(null, true);

    const result = await toLotDetail(mockCtx, createMockLot());

    expect(result.isSeller).toBe(true);
  });

  it("should handle missing category", async () => {
    mockCtx = setupMockCtx(null, true);
    const auction = createMockLot();

    const result = await toLotDetail(mockCtx, auction);

    expect(result.categoryName).toBe("Unknown");
  });

  it("should include all required fields", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category, true);
    const auction = createMockLot();

    const result = await toLotDetail(mockCtx, auction);

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
    expect(result).toHaveProperty("reserveState");
    expect(result).toHaveProperty("currentPrice");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("images");
  });

  it("should resolve all image slots including additional", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category, true);
    const auction = createMockLot();

    const result = await toLotDetail(mockCtx, auction);

    expect(result.images.front).toBeDefined();
    expect(result.images.engine).toBeDefined();
    expect(result.images.cabin).toBeDefined();
    expect(result.images.rear).toBeDefined();
    expect(result.images.additional.length).toBeGreaterThan(0);
  });

  it("should handle seller not found gracefully", async () => {
    const category = { _id: "cat_123", name: "Tractors", isActive: true };
    mockCtx = setupMockCtx(category, true);
    const auction = createMockLot();
    auction.sellerId = "nonexistent_seller";

    const result = await toLotDetail(mockCtx, auction);

    expect(result.sellerVatKind).toBe("vat");
  });

  it("looks the seller profile up by userId index", async () => {
    mockCtx = setupMockCtx(null, true, createMockSellerProfile());
    const indexBuilder = { eq: vi.fn(() => indexBuilder) };
    const profilesQuery = {
      withIndex: vi.fn((_index: string, cb?: (q: unknown) => unknown) => {
        if (cb) cb(indexBuilder);
        return profilesQuery;
      }),
      unique: vi.fn().mockResolvedValue(createMockSellerProfile()),
    };
    (mockCtx.db.query as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      profilesQuery
    );

    await toLotDetail(mockCtx, createMockLot());

    expect(profilesQuery.withIndex).toHaveBeenCalledWith(
      "by_userId",
      expect.any(Function)
    );
    expect(indexBuilder.eq).toHaveBeenCalledWith("userId", "seller_123");
  });
});

describe("toLotSummaries", () => {
  const baseLot = (overrides: Partial<Doc<"lots">> = {}) =>
    ({
      _id: "lot_1",
      _creationTime: Date.now(),
      title: "Lot",
      make: "John Deere",
      currentPrice: 100,
      status: "assigned",
      sellerId: "seller_1",
      images: { front: "front" },
      ...overrides,
    }) as unknown as Doc<"lots">;

  it("resolves each referenced category and auction exactly once", async () => {
    const dbGet = vi.fn((table: string) =>
      Promise.resolve(
        table === "equipmentCategories"
          ? { _id: "cat_1", name: "Tractors", isActive: true }
          : {
              _id: "auc_1",
              title: "Spring Sale",
              status: "published",
              startTime: 1000,
              endTime: 2000,
            }
      )
    );
    const ctx = {
      db: { get: dbGet },
    } as unknown as QueryCtx;

    const result = await toLotSummaries(ctx, [
      baseLot({ categoryId: "cat_1" as Id<"equipmentCategories"> }),
      baseLot({ auctionId: "auc_1" as Id<"auctions"> }),
      baseLot({}),
    ]);

    expect(result).toHaveLength(3);
    expect(dbGet).toHaveBeenCalledTimes(2);
    expect(result[0]?.categoryName).toBe("Tractors");
    expect(result[1]?.auctionStatus).toBe("published");
    expect(result[1]?.auctionEndTime).toBe(2000);
  });

  it("falls back to a placeholder name when a referenced document is gone", async () => {
    const ctx = {
      db: { get: vi.fn().mockResolvedValue(null) },
    } as unknown as QueryCtx;

    const result = await toLotSummaries(ctx, [
      baseLot({
        categoryId: "cat_missing" as Id<"equipmentCategories">,
        auctionId: "auc_missing" as Id<"auctions">,
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.categoryName).toBe("Unknown");
    expect(result[0]?.auctionStatus).toBeUndefined();
  });
});

describe("resolveLotPhotos", () => {
  const storage = {} as QueryCtx["storage"];
  const url = (id: string) => `https://example.com/images/${id}`;

  it("lists photos in gallery order with the angle keyed by storage ref", async () => {
    const photos = await resolveLotPhotos(
      storage,
      { front: "f", cabin: "c", additional: ["a1", "a2"] },
      { f: "front", a2: "hour_meter", a1: "not-an-angle" }
    );

    expect(photos).toEqual([
      { url: url("f"), angle: "front" },
      { url: url("c") },
      { url: url("a1") },
      { url: url("a2"), angle: "hour_meter" },
    ]);
  });

  it("accepts the legacy array form and no angles", async () => {
    expect(await resolveLotPhotos(storage, ["x", "y"], undefined)).toEqual([
      { url: url("x") },
      { url: url("y") },
    ]);
  });

  it("returns nothing for empty or unknown image values", async () => {
    expect(await resolveLotPhotos(storage, null, undefined)).toEqual([]);
    expect(await resolveLotPhotos(storage, {}, {})).toEqual([]);
  });
});
