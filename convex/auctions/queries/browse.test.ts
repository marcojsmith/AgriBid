import { describe, it, expect, vi, beforeEach } from "vitest";

import { getSellerInfoHandler } from "./browse";
import * as users from "../../users";
import type { QueryCtx } from "../../_generated/server";
import type { AuthUser } from "../../auth";

vi.mock("../../users", () => ({
  findUserById: vi.fn(),
}));

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
    vi.mocked(users.findUserById).mockResolvedValue(null);

    const result = await getSellerInfoHandler(mockCtx as unknown as QueryCtx, {
      sellerId: "nonexistent",
    });

    expect(result).toBeNull();
  });

  it("should return seller info with all profile fields", async () => {
    vi.mocked(users.findUserById).mockResolvedValue({
      _id: "auth123",
      userId: "user123",
      name: "John Dippenaar",
      createdAt: new Date("2026-01-15").getTime(),
    } as unknown as AuthUser);

    const mockProfileQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue({
        userId: "user123",
        role: "seller",
        isVerified: true,
        bio: "Commercial farmer",
        companyName: "Dippenaar Farms",
        location: "Lichtenburg, North West",
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
    expect(result?.itemsSold).toBe(2);
    expect(result?.activeListings).toBe(2);
    expect(result?.totalListings).toBe(4);
    expect(result?.bidsPlaced).toBe(3);
    expect(result?.avgSalePrice).toBe(291750);
  });

  it("should handle missing profile gracefully", async () => {
    vi.mocked(users.findUserById).mockResolvedValue({
      _id: "auth123",
      userId: "user123",
      name: "Jane Doe",
      createdAt: Date.now(),
    } as unknown as AuthUser);

    const mockProfileQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(null),
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
      return mockProfileQuery;
    });

    const result = await getSellerInfoHandler(mockCtx as unknown as QueryCtx, {
      sellerId: "user123",
    });

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Jane Doe");
    expect(result?.isVerified).toBe(false);
    expect(result?.role).toBe("Private Seller");
    expect(result?.bio).toBeUndefined();
    expect(result?.companyName).toBeUndefined();
    expect(result?.location).toBeUndefined();
    expect(result?.activeListings).toBe(0);
    expect(result?.totalListings).toBe(0);
  });

  it("should handle zero sold auctions (no avgSalePrice)", async () => {
    vi.mocked(users.findUserById).mockResolvedValue({
      _id: "auth123",
      userId: "user123",
      name: "New Seller",
      createdAt: Date.now(),
    } as unknown as AuthUser);

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
  });
});
