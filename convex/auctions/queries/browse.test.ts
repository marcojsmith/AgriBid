import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getActiveLotsHandler,
  getActiveMakesHandler,
  getLotByIdHandler,
  getRelatedLots,
  getSellerInfoHandler,
  getSellerListingsHandler,
} from "./browse";
import * as auth from "../../lib/auth";
import * as helpers from "../helpers";
import { MAX_RESULTS_CAP } from "../../constants";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";

vi.mock("../../_generated/server", () => ({
  query: vi.fn((query: unknown) => query),
  mutation: vi.fn((mutation: unknown) => mutation),
  internalQuery: vi.fn((query: unknown) => query),
  internalMutation: vi.fn((mutation: unknown) => mutation),
}));

vi.mock("../../lib/auth", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAuthenticatedProfile: vi.fn(),
}));

vi.mock("../helpers", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  toLotSummaries: vi.fn(async (_ctx: unknown, lots: Doc<"lots">[]) => lots),
  toLotDetail: vi.fn(async (_ctx: unknown, lot: Doc<"lots">) => lot),
}));

/**
 * Chainable stand-in for the Convex index-range builder. It records every call
 * so tests can assert which index/constraints were used.
 *
 * @returns The recording index-range double
 */
function createIndexBuilderStub() {
  const builder = {
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    search: vi.fn(() => builder),
  };
  return builder;
}

/**
 * Chainable stand-in for the Convex expression builder used inside `filter`.
 *
 * @returns The recording filter-expression double
 */
function createFilterBuilderStub() {
  const builder = {
    field: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    or: vi.fn(() => builder),
    and: vi.fn(() => builder),
  };
  return builder;
}

interface FakeQuery {
  withIndex: ReturnType<typeof vi.fn>;
  withSearchIndex: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  filter: ReturnType<typeof vi.fn>;
  take: ReturnType<typeof vi.fn>;
  paginate: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  indexBuilder: ReturnType<typeof createIndexBuilderStub>;
  filterBuilder: ReturnType<typeof createFilterBuilderStub>;
}

/**
 * Minimal in-memory query builder that runs the index/filter callbacks so the
 * branches inside those callbacks are exercised, but does not evaluate the
 * constraints (row selection is controlled by the rows passed in).
 *
 * @param rows - Documents every terminal method resolves with
 * @returns The query double plus its recorded builders
 */
function createFakeQuery(rows: Doc<"lots">[]): FakeQuery {
  const indexBuilder = createIndexBuilderStub();
  const filterBuilder = createFilterBuilderStub();
  const query = {
    withIndex: vi.fn((_name: string, cb?: (q: unknown) => unknown) => {
      if (cb) cb(indexBuilder);
      return query;
    }),
    withSearchIndex: vi.fn((_name: string, cb?: (q: unknown) => unknown) => {
      if (cb) cb(indexBuilder);
      return query;
    }),
    order: vi.fn(() => query),
    filter: vi.fn((cb?: (q: unknown) => unknown) => {
      if (cb) cb(filterBuilder);
      return query;
    }),
    take: vi.fn(async (count: number) => rows.slice(0, count)),
    paginate: vi.fn(async () => ({
      page: rows,
      isDone: true,
      continueCursor: "",
    })),
    collect: vi.fn(async () => rows),
    count: vi.fn(async () => rows.length),
    indexBuilder,
    filterBuilder,
  };
  return query;
}

/**
 * Minimal QueryCtx double for browse queries: a single lots table plus explicit
 * auction/category lookups.
 *
 * @param options - Fixture rows for the fake tables
 * @param options.lots - Lots the fake `lots` table returns
 * @param options.auctions - Auctions keyed by id for `db.get`
 * @returns The context double plus its `lots` query double
 */
function createBrowseCtx(
  options: {
    lots?: Doc<"lots">[];
    auctions?: Record<string, Doc<"auctions">>;
  } = {}
) {
  const { lots = [], auctions = {} } = options;
  const lotsQuery = createFakeQuery(lots);
  return {
    lotsQuery,
    ctx: {
      db: {
        query: vi.fn(() => lotsQuery),
        get: vi.fn(async (_table: string, id: string) => {
          if (id in auctions) return auctions[id];
          return lots.find((lot) => lot._id === id) ?? null;
        }),
      },
      storage: { getUrl: vi.fn(async () => null) },
    },
  };
}

const NOW = Date.now();

/**
 * Loose override shape for {@link makeLiveLot}: ids are plain strings in
 * fixtures, which the helper casts back to the branded `Id` types.
 */
type LotOverrides = Partial<Omit<Doc<"lots">, "_id" | "auctionId">> & {
  _id?: string;
  auctionId?: string;
};

/**
 * Loose override shape for {@link makePublishedAuction}.
 */
type AuctionOverrides = Partial<Omit<Doc<"auctions">, "_id">> & {
  _id?: string;
};

/**
 * Builds an `assigned` lot that is live inside its parent auction window.
 *
 * @param overrides - Fields to override on the default lot
 * @returns The lot document
 */
function makeLiveLot(overrides: LotOverrides = {}): Doc<"lots"> {
  return {
    _id: "lot1",
    _creationTime: NOW,
    title: "John Deere 8R",
    make: "John Deere",
    model: "8R",
    year: 2020,
    operatingHours: 1000,
    location: "ZA",
    status: "assigned",
    sellerId: "seller1",
    currentPrice: 100000,
    startingPrice: 50000,
    reservePrice: 60000,
    minIncrement: 1000,
    auctionId: "auction1",
    ...overrides,
  } as unknown as Doc<"lots">;
}

/**
 * Builds a published auction whose window currently spans `now`.
 *
 * @param overrides - Fields to override on the default auction
 * @returns The auction document
 */
function makePublishedAuction(
  overrides: AuctionOverrides = {}
): Doc<"auctions"> {
  return {
    _id: "auction1",
    _creationTime: NOW,
    title: "Winter Auction",
    status: "published",
    startTime: NOW - 60_000,
    endTime: NOW + 60_000,
    ...overrides,
  } as unknown as Doc<"auctions">;
}

describe("getSellerInfoHandler", () => {
  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        query: vi.fn(),
      },
    };
  });

  it("should return null when user is not found", async () => {
    const mockProfileQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(null),
    };
    mockCtx.db.query.mockReturnValue(mockProfileQuery);

    const result = await getSellerInfoHandler(mockCtx as unknown as QueryCtx, {
      sellerId: "nonexistent",
    });

    expect(result).toBeNull();
  });

  it("should return seller info with all profile fields", async () => {
    const mockProfileQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue({
        userId: "user123",
        name: "John Dippenaar",
        createdAt: new Date("2026-01-15").getTime(),
        role: "seller",
        isVerified: true,
        kycStatus: "verified",
        bio: "Commercial farmer",
        companyName: "Dippenaar Farms",
        location: "Lichtenburg, North West",
        emailVerified: true,
        phoneVerified: false,
        bankingVerified: true,
        taxNumberVerified: false,
      }),
    };

    const mockSoldAuctionsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi
        .fn()
        .mockResolvedValue([{ currentPrice: 485000 }, { currentPrice: 98500 }]),
    };

    const mockActiveAuctionsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{}, {}]),
    };

    const mockBidsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{}, {}, {}]),
    };

    const mockReviewsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{ rating: 5 }, { rating: 4 }]),
    };

    // The mock uses queryCallCount to distinguish auction queries by call order:
    // - queryCallCount === 2 returns mockSoldAuctionsQuery (sold count)
    // - queryCallCount === 3 returns mockActiveAuctionsQuery (active count)
    // NOTE: This couples the test to the implementation's query order, so future
    // maintainers must adjust if the implementation's query order changes.
    let queryCallCount = 0;
    mockCtx.db.query.mockImplementation((table: string) => {
      queryCallCount++;
      if (table === "profiles") return mockProfileQuery;
      if (table === "lots") {
        if (queryCallCount === 2) return mockSoldAuctionsQuery;
        if (queryCallCount === 3) return mockActiveAuctionsQuery;
        return mockSoldAuctionsQuery;
      }
      if (table === "bids") return mockBidsQuery;
      if (table === "reviews") return mockReviewsQuery;
      return mockProfileQuery;
    });

    const result = await getSellerInfoHandler(mockCtx as unknown as QueryCtx, {
      sellerId: "user123",
    });

    expect(result).not.toBeNull();
    expect(result?.name).toBe("John Dippenaar");
    expect(result?.isVerified).toBe(true);
    expect(result?.role).toBe("seller");
    expect(result?.bio).toBe("Commercial farmer");
    expect(result?.companyName).toBe("Dippenaar Farms");
    expect(result?.location).toBe("Lichtenburg, North West");
    expect(result?.kycStatus).toBe("verified");
    expect(result?.emailVerified).toBe(true);
    expect(result?.phoneVerified).toBe(false);
    expect(result?.bankingVerified).toBe(true);
    expect(result?.taxNumberVerified).toBe(false);
    expect(result?.itemsSold).toBe(2);
    expect(result?.activeListings).toBe(2);
    expect(result?.totalListings).toBe(4);
    expect(result?.bidsPlaced).toBe(3);
    expect(result?.avgSalePrice).toBe(291750);
    expect(result?.avgRating).toBe(4.5);
    expect(result?.reviewCount).toBe(2);
  });

  it("should handle profile with missing optional fields gracefully", async () => {
    const mockProfileQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue({
        userId: "user123",
        role: "buyer",
        isVerified: false,
        createdAt: Date.now(),
      }),
    };

    const mockSoldAuctionsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    const mockActiveAuctionsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    const mockBidsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    const mockReviewsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    // The mock uses queryCallCount to distinguish auction queries by call order.
    // NOTE: This couples the test to the implementation's query order.
    let queryCallCount = 0;
    mockCtx.db.query.mockImplementation((table: string) => {
      queryCallCount++;
      if (table === "profiles") return mockProfileQuery;
      if (table === "lots") {
        if (queryCallCount === 2) return mockSoldAuctionsQuery;
        if (queryCallCount === 3) return mockActiveAuctionsQuery;
        return mockSoldAuctionsQuery;
      }
      if (table === "bids") return mockBidsQuery;
      if (table === "reviews") return mockReviewsQuery;
      return mockProfileQuery;
    });

    const result = await getSellerInfoHandler(mockCtx as unknown as QueryCtx, {
      sellerId: "user123",
    });

    expect(result).not.toBeNull();
    expect(result?.name).toBeUndefined();
    expect(result?.isVerified).toBe(false);
    expect(result?.role).toBe("buyer");
    expect(result?.bio).toBeUndefined();
    expect(result?.companyName).toBeUndefined();
    expect(result?.location).toBeUndefined();
    expect(result?.kycStatus).toBeUndefined();
    expect(result?.emailVerified).toBeUndefined();
    expect(result?.phoneVerified).toBeUndefined();
    expect(result?.bankingVerified).toBeUndefined();
    expect(result?.taxNumberVerified).toBeUndefined();
    expect(result?.activeListings).toBe(0);
    expect(result?.totalListings).toBe(0);
    expect(result?.avgRating).toBeUndefined();
    expect(result?.reviewCount).toBe(0);
  });

  it("should handle zero sold auctions (no avgSalePrice)", async () => {
    const mockProfileQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue({
        userId: "user123",
        role: "seller",
        isVerified: false,
      }),
    };

    const mockSoldAuctionsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    const mockActiveAuctionsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{}]),
    };

    const mockBidsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{}]),
    };

    const mockReviewsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    // The mock uses queryCallCount to distinguish auction queries by call order.
    // NOTE: This couples the test to the implementation's query order.
    let queryCallCount = 0;
    mockCtx.db.query.mockImplementation((table: string) => {
      queryCallCount++;
      if (table === "profiles") return mockProfileQuery;
      if (table === "lots") {
        if (queryCallCount === 2) return mockSoldAuctionsQuery;
        if (queryCallCount === 3) return mockActiveAuctionsQuery;
        return mockSoldAuctionsQuery;
      }
      if (table === "bids") return mockBidsQuery;
      if (table === "reviews") return mockReviewsQuery;
      return mockProfileQuery;
    });

    const result = await getSellerInfoHandler(mockCtx as unknown as QueryCtx, {
      sellerId: "user123",
    });

    expect(result).not.toBeNull();
    expect(result?.itemsSold).toBe(0);
    expect(result?.activeListings).toBe(1);
    expect(result?.totalListings).toBe(1);
    expect(result?.avgSalePrice).toBeUndefined();
    expect(result?.bidsPlaced).toBe(1);
    expect(result?.avgRating).toBeUndefined();
    expect(result?.reviewCount).toBe(0);
  });
});

describe("getSellerListingsHandler", () => {
  const mockLotDocs = [
    { _id: "lot1", title: "Active Tractor", status: "assigned" },
    { _id: "lot2", title: "Sold Baler", status: "sold" },
  ];

  let mockCtx: {
    db: {
      get: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
    storage: {
      getUrl: ReturnType<typeof vi.fn>;
    };
  };

  let mockListingsQuery: {
    withIndex: ReturnType<typeof vi.fn>;
    filter: ReturnType<typeof vi.fn>;
    paginate: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };

  let qMock: {
    eq: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    field: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();

    qMock = {
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      field: vi.fn().mockReturnThis(),
    };

    mockListingsQuery = {
      withIndex: vi.fn((_idx: string, cb?: (q: unknown) => unknown) => {
        if (cb) cb(qMock);
        return mockListingsQuery;
      }),
      filter: vi.fn((cb?: (q: unknown) => unknown) => {
        if (cb) cb(qMock);
        return mockListingsQuery;
      }),
      paginate: vi.fn().mockResolvedValue({
        page: mockLotDocs,
        isDone: true,
        continueCursor: "",
      }),
      count: vi.fn().mockResolvedValue(2),
    };

    mockCtx = {
      db: {
        get: vi.fn().mockResolvedValue(null),
        query: vi.fn().mockReturnValue(mockListingsQuery),
      },
      storage: {
        getUrl: vi.fn(),
      },
    };
  });

  it("should use by_seller index with in-memory status filter when statusFilter is omitted", async () => {
    const result = await getSellerListingsHandler(
      mockCtx as unknown as QueryCtx,
      { userId: "user123", paginationOpts: { numItems: 12, cursor: null } }
    );

    expect(mockListingsQuery.withIndex).toHaveBeenCalledWith(
      "by_seller",
      expect.any(Function)
    );
    expect(mockListingsQuery.withIndex).not.toHaveBeenCalledWith(
      "by_seller_status",
      expect.any(Function)
    );
    expect(qMock.eq).toHaveBeenCalledWith("sellerId", "user123");
    expect(qMock.field).toHaveBeenCalledWith("status");
    expect(qMock.or).toHaveBeenCalled();
    expect(qMock.eq).toHaveBeenCalledWith(expect.anything(), "assigned");
    expect(qMock.eq).toHaveBeenCalledWith(expect.anything(), "sold");

    expect(result.page).toHaveLength(2);
    expect(result.page.map((a) => a._id)).toEqual(["lot1", "lot2"]);
    expect(result.totalCount).toBe(2);
    expect(result.isDone).toBe(true);
  });

  it("should use by_seller_status index with assigned status when statusFilter is active", async () => {
    const result = await getSellerListingsHandler(
      mockCtx as unknown as QueryCtx,
      {
        userId: "user123",
        statusFilter: "active",
        paginationOpts: { numItems: 12, cursor: null },
      }
    );

    expect(mockListingsQuery.withIndex).toHaveBeenCalledWith(
      "by_seller_status",
      expect.any(Function)
    );
    expect(mockListingsQuery.withIndex).not.toHaveBeenCalledWith(
      "by_seller",
      expect.any(Function)
    );
    expect(qMock.eq).toHaveBeenCalledWith("sellerId", "user123");
    expect(qMock.eq).toHaveBeenCalledWith("status", "assigned");

    expect(result.page).toHaveLength(2);
    expect(result.totalCount).toBe(2);
    expect(result.isDone).toBe(true);
  });

  it("should use by_seller_status index with sold status when statusFilter is sold", async () => {
    const result = await getSellerListingsHandler(
      mockCtx as unknown as QueryCtx,
      {
        userId: "user123",
        statusFilter: "sold",
        paginationOpts: { numItems: 12, cursor: null },
      }
    );

    expect(mockListingsQuery.withIndex).toHaveBeenCalledWith(
      "by_seller_status",
      expect.any(Function)
    );
    expect(qMock.eq).toHaveBeenCalledWith("sellerId", "user123");
    expect(qMock.eq).toHaveBeenCalledWith("status", "sold");

    expect(result.page).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });
});

describe("getActiveLotsHandler", () => {
  const paginationOpts = { numItems: 10, cursor: null } as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty page when the scoped auction does not exist", async () => {
    const { ctx } = createBrowseCtx();

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
      auctionId: "missing-auction" as Id<"auctions">,
    });

    expect(result).toEqual({
      page: [],
      isDone: true,
      continueCursor: "",
      totalCount: 0,
    });
  });

  it("returns an empty page when the scoped auction is still a draft", async () => {
    const { ctx } = createBrowseCtx({
      auctions: {
        auction1: makePublishedAuction({
          _id: "auction1",
          status: "draft",
        }),
      },
    });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
      auctionId: "auction1" as Id<"auctions">,
    });

    expect(result.page).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.isDone).toBe(true);
  });

  it("uses the by_status index and keeps only lots inside a live auction window", async () => {
    const live = makeLiveLot({ _id: "live" });
    const notYetStarted = makeLiveLot({
      _id: "future",
      auctionId: "auction2",
    });
    const soldStatus = makeLiveLot({ _id: "sold-status", status: "sold" });
    const { ctx, lotsQuery } = createBrowseCtx({
      lots: [live, notYetStarted, soldStatus],
      auctions: {
        auction1: makePublishedAuction({ _id: "auction1" }),
        auction2: makePublishedAuction({
          _id: "auction2",
          startTime: Date.now() + 600_000,
          endTime: Date.now() + 1_200_000,
        }),
      },
    });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
    });

    expect(lotsQuery.withIndex).toHaveBeenCalledWith(
      "by_status",
      expect.any(Function)
    );
    expect(lotsQuery.indexBuilder.eq).toHaveBeenCalledWith(
      "status",
      "assigned"
    );
    expect(lotsQuery.take).toHaveBeenCalledWith(MAX_RESULTS_CAP + 1);
    expect(result.page.map((lot) => lot._id)).toEqual(["live"]);
    expect(result.totalCount).toBe(1);
    expect(result.isDone).toBe(true);
    expect(result.continueCursor).toBe("");
  });

  it("prefers extendedEndTime over the auction end time when checking liveness", async () => {
    const lot = makeLiveLot({
      _id: "extended",
      extendedEndTime: Date.now() - 1,
    });
    const { ctx } = createBrowseCtx({
      lots: [lot],
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
    });

    expect(result.page).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("excludes lots whose parent auction is not published", async () => {
    const lot = makeLiveLot({ _id: "draft-parent" });
    const { ctx } = createBrowseCtx({
      lots: [lot],
      auctions: {
        auction1: makePublishedAuction({
          _id: "auction1",
          status: "draft",
        }),
      },
    });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
    });

    expect(result.totalCount).toBe(0);
  });

  it("excludes assigned lots that are missing an auctionId", async () => {
    const lot = makeLiveLot({ _id: "orphan", auctionId: undefined });
    const { ctx } = createBrowseCtx({ lots: [lot] });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
    });

    expect(result.totalCount).toBe(0);
  });

  it("paginates the manually filtered page using the cursor", async () => {
    const lots = [
      makeLiveLot({ _id: "l1" }),
      makeLiveLot({ _id: "l2" }),
      makeLiveLot({ _id: "l3" }),
    ];
    const { ctx } = createBrowseCtx({
      lots,
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });

    const firstPage = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts: { numItems: 2, cursor: null },
    });

    expect(firstPage.page.map((lot) => lot._id)).toEqual(["l1", "l2"]);
    expect(firstPage.isDone).toBe(false);
    expect(firstPage.continueCursor).toBe("2");

    const secondPage = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts: { numItems: 2, cursor: firstPage.continueCursor },
    });

    expect(secondPage.page.map((lot) => lot._id)).toEqual(["l3"]);
    expect(secondPage.isDone).toBe(true);
    expect(secondPage.continueCursor).toBe("");
  });

  it("caps totalCount at 1000+ when more lots match than the results cap", async () => {
    const lots = Array.from({ length: MAX_RESULTS_CAP + 1 }, (_, index) =>
      makeLiveLot({ _id: `l${String(index)}` })
    );
    const { ctx } = createBrowseCtx({
      lots,
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts: { numItems: 5, cursor: null },
    });

    expect(result.totalCount).toBe("1000+");
    expect(result.page).toHaveLength(5);
  });

  it("applies make, year, price and hours filters in memory", async () => {
    const matching = makeLiveLot({ _id: "match" });
    const wrongMake = makeLiveLot({ _id: "wrong-make", make: "Claas" });
    const tooOld = makeLiveLot({ _id: "too-old", year: 1990 });
    const tooNew = makeLiveLot({ _id: "too-new", year: 2030 });
    const tooCheap = makeLiveLot({ _id: "too-cheap", currentPrice: 10 });
    const tooDear = makeLiveLot({ _id: "too-dear", currentPrice: 9_000_000 });
    const tooManyHours = makeLiveLot({
      _id: "too-many-hours",
      operatingHours: 9000,
    });
    const { ctx, lotsQuery } = createBrowseCtx({
      lots: [
        matching,
        wrongMake,
        tooOld,
        tooNew,
        tooCheap,
        tooDear,
        tooManyHours,
      ],
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
      make: "John Deere",
      minYear: 2015,
      maxYear: 2025,
      minPrice: 1000,
      maxPrice: 5_000_000,
      maxHours: 5000,
    });

    expect(result.page.map((lot) => lot._id)).toEqual(["match"]);
    expect(lotsQuery.indexBuilder.eq).toHaveBeenCalledWith(
      "make",
      "John Deere"
    );
    expect(lotsQuery.filterBuilder.gte).toHaveBeenCalled();
    expect(lotsQuery.filterBuilder.lte).toHaveBeenCalled();
  });

  it("drops lots that belong to a different auction when scoped by auctionId", async () => {
    const mine = makeLiveLot({ _id: "mine" });
    const theirs = makeLiveLot({ _id: "theirs", auctionId: "auction2" });
    const { ctx, lotsQuery } = createBrowseCtx({
      lots: [mine, theirs],
      auctions: {
        auction1: makePublishedAuction({ _id: "auction1" }),
        auction2: makePublishedAuction({ _id: "auction2" }),
      },
    });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
      auctionId: "auction1" as Id<"auctions">,
    });

    expect(lotsQuery.withIndex).toHaveBeenCalledWith(
      "by_auctionId",
      expect.any(Function)
    );
    expect(lotsQuery.filterBuilder.eq).toHaveBeenCalledWith(
      expect.anything(),
      "assigned"
    );
    expect(result.page.map((lot) => lot._id)).toEqual(["mine"]);
  });

  it("uses the search_title index with a status filter for active searches", async () => {
    const lot = makeLiveLot({ _id: "search-hit" });
    const { ctx, lotsQuery } = createBrowseCtx({
      lots: [lot],
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
      search: "tractor",
    });

    expect(lotsQuery.withSearchIndex).toHaveBeenCalledWith(
      "search_title",
      expect.any(Function)
    );
    expect(lotsQuery.indexBuilder.search).toHaveBeenCalledWith(
      "title",
      "tractor"
    );
    expect(result.page.map((entry) => entry._id)).toEqual(["search-hit"]);
  });

  it("uses the simple search index when searching every status", async () => {
    const lot = makeLiveLot({ _id: "closed-hit", status: "unsold" });
    const { ctx, lotsQuery } = createBrowseCtx({
      lots: [lot],
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
      search: "baler",
      statusFilter: "all",
    });

    expect(lotsQuery.withSearchIndex).toHaveBeenCalledWith(
      "search_title_simple",
      expect.any(Function)
    );
    expect(result.page.map((entry) => entry._id)).toEqual(["closed-hit"]);
  });

  it("uses the make index for active status and an order/filter scan otherwise", async () => {
    const active = makeLiveLot({ _id: "active-make" });
    const activeCtx = createBrowseCtx({
      lots: [active],
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });

    await getActiveLotsHandler(activeCtx.ctx as unknown as QueryCtx, {
      paginationOpts,
      make: "John Deere",
    });

    expect(activeCtx.lotsQuery.withIndex).toHaveBeenCalledWith(
      "by_status_make",
      expect.any(Function)
    );
    expect(activeCtx.lotsQuery.indexBuilder.eq).toHaveBeenCalledWith(
      "status",
      "assigned"
    );

    const closed = makeLiveLot({ _id: "closed-make", status: "sold" });
    const closedCtx = createBrowseCtx({ lots: [closed] });

    const result = await getActiveLotsHandler(
      closedCtx.ctx as unknown as QueryCtx,
      { paginationOpts, make: "John Deere", statusFilter: "closed" }
    );

    expect(closedCtx.lotsQuery.withIndex).not.toHaveBeenCalled();
    expect(closedCtx.lotsQuery.order).toHaveBeenCalledWith("desc");
    expect(closedCtx.lotsQuery.filterBuilder.eq).toHaveBeenCalledWith(
      expect.anything(),
      "John Deere"
    );
    expect(result.page.map((lot) => lot._id)).toEqual(["closed-make"]);
  });

  it("builds year range index constraints for each year filter combination", async () => {
    const lot = makeLiveLot({ _id: "year-hit" });

    const bothCtx = createBrowseCtx({
      lots: [lot],
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });
    await getActiveLotsHandler(bothCtx.ctx as unknown as QueryCtx, {
      paginationOpts,
      minYear: 2010,
      maxYear: 2024,
    });
    expect(bothCtx.lotsQuery.withIndex).toHaveBeenCalledWith(
      "by_status_year",
      expect.any(Function)
    );
    expect(bothCtx.lotsQuery.indexBuilder.gte).toHaveBeenCalledWith(
      "year",
      2010
    );
    expect(bothCtx.lotsQuery.indexBuilder.lte).toHaveBeenCalledWith(
      "year",
      2024
    );

    const minOnlyCtx = createBrowseCtx({
      lots: [lot],
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });
    await getActiveLotsHandler(minOnlyCtx.ctx as unknown as QueryCtx, {
      paginationOpts,
      minYear: 2010,
    });
    expect(minOnlyCtx.lotsQuery.indexBuilder.gte).toHaveBeenCalledWith(
      "year",
      2010
    );
    expect(minOnlyCtx.lotsQuery.indexBuilder.lte).not.toHaveBeenCalled();

    const maxOnlyCtx = createBrowseCtx({
      lots: [lot],
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });
    await getActiveLotsHandler(maxOnlyCtx.ctx as unknown as QueryCtx, {
      paginationOpts,
      maxYear: 2024,
    });
    expect(maxOnlyCtx.lotsQuery.indexBuilder.lte).toHaveBeenCalledWith(
      "year",
      2024
    );

    const multiStatusCtx = createBrowseCtx({ lots: [lot] });
    const multiStatusResult = await getActiveLotsHandler(
      multiStatusCtx.ctx as unknown as QueryCtx,
      { paginationOpts, minYear: 2010, statusFilter: "all" }
    );
    expect(multiStatusCtx.lotsQuery.order).toHaveBeenCalledWith("desc");
    expect(multiStatusResult.totalCount).toBe(1);
  });

  it("paginates through the database for every status when no window check is needed", async () => {
    const lots = [
      makeLiveLot({ _id: "sold", status: "sold" }),
      makeLiveLot({ _id: "unsold", status: "unsold" }),
    ];
    const { ctx, lotsQuery } = createBrowseCtx({ lots });

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
      statusFilter: "closed",
    });

    expect(lotsQuery.paginate).toHaveBeenCalledWith(paginationOpts);
    expect(lotsQuery.order).toHaveBeenCalledWith("desc");
    expect(lotsQuery.filterBuilder.or).toHaveBeenCalled();
    expect(result.page.map((lot) => lot._id)).toEqual(["sold", "unsold"]);
    expect(result.totalCount).toBe(2);
  });

  it("caps the database total count at 1000+", async () => {
    const { ctx, lotsQuery } = createBrowseCtx({ lots: [] });
    lotsQuery.count.mockResolvedValue(1500);

    const result = await getActiveLotsHandler(ctx as unknown as QueryCtx, {
      paginationOpts,
      statusFilter: "all",
    });

    expect(result.totalCount).toBe("1000+");
  });
});

describe("getRelatedLots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const callHandler = async (
    ctx: unknown,
    args: { make: string; excludeId: Id<"lots"> }
  ) =>
    await (
      getRelatedLots as unknown as {
        handler: (ctx: unknown, args: unknown) => Promise<Doc<"lots">[]>;
      }
    ).handler(ctx, args);

  it("returns only live lots of the same make and stops at four", async () => {
    const lots = Array.from({ length: 6 }, (_, index) =>
      makeLiveLot({ _id: `l${String(index)}` })
    );
    const dead = makeLiveLot({ _id: "dead", status: "unsold" });
    const { ctx, lotsQuery } = createBrowseCtx({
      lots: [...lots, dead],
      auctions: { auction1: makePublishedAuction({ _id: "auction1" }) },
    });

    const related = await callHandler(ctx, {
      make: "John Deere",
      excludeId: "current" as Id<"lots">,
    });

    expect(lotsQuery.withIndex).toHaveBeenCalledWith(
      "by_status_make",
      expect.any(Function)
    );
    expect(lotsQuery.indexBuilder.eq).toHaveBeenCalledWith(
      "make",
      "John Deere"
    );
    expect(lotsQuery.take).toHaveBeenCalledWith(MAX_RESULTS_CAP + 1);
    expect(related.map((lot) => lot._id)).toEqual(["l0", "l1", "l2", "l3"]);
  });

  it("returns an empty array when nothing is live", async () => {
    const { ctx } = createBrowseCtx({
      lots: [makeLiveLot({ _id: "closed", status: "unsold" })],
    });

    const related = await callHandler(ctx, {
      make: "John Deere",
      excludeId: "current" as Id<"lots">,
    });

    expect(related).toEqual([]);
  });
});

describe("getActiveMakesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges indexed active makes with legacy rows and sorts them", async () => {
    const indexed = {
      _id: "m1",
      make: "Claas",
      isActive: true,
    } as unknown as Doc<"equipmentMetadata">;
    const legacy = {
      _id: "m2",
      make: "Agrico",
    } as unknown as Doc<"equipmentMetadata">;
    const duplicate = {
      _id: "m3",
      make: "Claas",
      isActive: true,
    } as unknown as Doc<"equipmentMetadata">;

    const indexedQuery = createFakeQuery([indexed, duplicate] as never);
    const legacyQuery = createFakeQuery([legacy] as never);
    const query = vi
      .fn()
      .mockReturnValueOnce(indexedQuery)
      .mockReturnValueOnce(legacyQuery);
    const ctx = { db: { query } };

    const makes = await getActiveMakesHandler(ctx as unknown as QueryCtx);

    expect(indexedQuery.withIndex).toHaveBeenCalledWith(
      "by_isActive",
      expect.any(Function)
    );
    expect(indexedQuery.indexBuilder.eq).toHaveBeenCalledWith("isActive", true);
    expect(legacyQuery.filter).toHaveBeenCalled();
    expect(makes).toEqual(["Agrico", "Claas"]);
  });
});

describe("getLotByIdHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.getAuthenticatedProfile).mockReset();
  });

  it("returns null when the lot does not exist", async () => {
    const { ctx } = createBrowseCtx();

    const result = await getLotByIdHandler(ctx as unknown as QueryCtx, {
      lotId: "nope" as Id<"lots">,
    });

    expect(result).toBeNull();
    expect(helpers.toLotDetail).not.toHaveBeenCalled();
  });

  it("returns public lots without requiring authentication", async () => {
    const lot = makeLiveLot({ _id: "public", status: "sold" });
    const { ctx } = createBrowseCtx({ lots: [lot] });

    const result = await getLotByIdHandler(ctx as unknown as QueryCtx, {
      lotId: "public" as Id<"lots">,
    });

    expect(result).toEqual(lot);
    expect(auth.getAuthenticatedProfile).not.toHaveBeenCalled();
  });

  it("returns null for a private lot when the caller is anonymous", async () => {
    const lot = makeLiveLot({ _id: "private", status: "draft" });
    const { ctx } = createBrowseCtx({ lots: [lot] });
    vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue(null);

    const result = await getLotByIdHandler(ctx as unknown as QueryCtx, {
      lotId: "private" as Id<"lots">,
    });

    expect(result).toBeNull();
  });

  it("returns null for a private lot when the caller has no profile", async () => {
    const lot = makeLiveLot({ _id: "private", status: "pending_review" });
    const { ctx } = createBrowseCtx({ lots: [lot] });
    vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
      authUser: { _id: "auth1" },
      userId: "auth1",
      profile: null,
    } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);

    const result = await getLotByIdHandler(ctx as unknown as QueryCtx, {
      lotId: "private" as Id<"lots">,
    });

    expect(result).toBeNull();
  });

  it("allows an admin to read a private lot", async () => {
    const lot = makeLiveLot({ _id: "private", status: "draft" });
    const { ctx } = createBrowseCtx({ lots: [lot] });
    vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
      authUser: { _id: "admin1" },
      userId: "admin1",
      profile: { role: "admin" },
    } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);

    const result = await getLotByIdHandler(ctx as unknown as QueryCtx, {
      lotId: "private" as Id<"lots">,
    });

    expect(result).toEqual(lot);
  });

  it("allows the owner to read their own private lot", async () => {
    const lot = makeLiveLot({ _id: "private", status: "draft" });
    const { ctx } = createBrowseCtx({ lots: [lot] });
    vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
      authUser: { _id: "seller1" },
      userId: "seller1",
      profile: { role: "seller" },
    } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);

    const result = await getLotByIdHandler(ctx as unknown as QueryCtx, {
      lotId: "private" as Id<"lots">,
    });

    expect(result).toEqual(lot);
  });

  it("allows the owner matched by the resolved link id to read a private lot", async () => {
    const lot = makeLiveLot({
      _id: "private",
      status: "draft",
      sellerId: "link1",
    });
    const { ctx } = createBrowseCtx({ lots: [lot] });
    vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
      authUser: { _id: "auth9" },
      userId: "link1",
      profile: { role: "seller" },
    } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);

    const result = await getLotByIdHandler(ctx as unknown as QueryCtx, {
      lotId: "private" as Id<"lots">,
    });

    expect(result).toEqual(lot);
  });

  it("hides a private lot from a different signed-in user", async () => {
    const lot = makeLiveLot({
      _id: "private",
      status: "draft",
      sellerId: "seller1",
    });
    const { ctx } = createBrowseCtx({ lots: [lot] });
    vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
      authUser: { _id: "other" },
      userId: "other",
      profile: { role: "buyer" },
    } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);

    const result = await getLotByIdHandler(ctx as unknown as QueryCtx, {
      lotId: "private" as Id<"lots">,
    });

    expect(result).toBeNull();
    expect(helpers.toLotDetail).not.toHaveBeenCalled();
  });
});
