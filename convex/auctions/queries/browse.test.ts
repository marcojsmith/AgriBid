import { describe, it, expect, vi, beforeEach } from "vitest";

import { getSellerInfoHandler, getSellerListingsHandler } from "./browse";
import type { QueryCtx } from "../../_generated/server";

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
      if (table === "auctions") {
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
      if (table === "auctions") {
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
      if (table === "auctions") {
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
  const mockAuctionDocs = [
    { _id: "auction1", title: "Active Tractor", status: "active" },
    { _id: "auction2", title: "Sold Baler", status: "sold" },
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
        page: mockAuctionDocs,
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
    expect(qMock.eq).toHaveBeenCalledWith(expect.anything(), "active");
    expect(qMock.eq).toHaveBeenCalledWith(expect.anything(), "sold");

    expect(result.page).toHaveLength(2);
    expect(result.page.map((a) => a._id)).toEqual(["auction1", "auction2"]);
    expect(result.totalCount).toBe(2);
    expect(result.isDone).toBe(true);
  });

  it("should use by_seller_status index with active status when statusFilter is active", async () => {
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
    expect(qMock.eq).toHaveBeenCalledWith("status", "active");

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
