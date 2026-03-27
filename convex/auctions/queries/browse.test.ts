import { describe, it, expect, vi, beforeEach } from "vitest";

import { getSellerInfoHandler } from "./browse";
import * as users from "../../users";
import type { QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";

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
    } as unknown as Doc<"profiles">);

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

    const mockAllListingsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{}, {}, {}, {}]),
    };

    const mockBidsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{}, {}, {}]),
    };

    let queryCallCount = 0;
    mockCtx.db.query.mockImplementation((table: string) => {
      queryCallCount++;
      if (table === "profiles") return mockProfileQuery;
      if (table === "auctions") {
        if (queryCallCount === 2) return mockSoldAuctionsQuery;
        return mockAllListingsQuery;
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
    } as unknown as Doc<"profiles">);

    const mockProfileQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(null),
    };

    const mockSoldAuctionsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    const mockAllListingsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    const mockBidsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    let queryCallCount = 0;
    mockCtx.db.query.mockImplementation((table: string) => {
      queryCallCount++;
      if (table === "profiles") return mockProfileQuery;
      if (table === "auctions") {
        if (queryCallCount === 2) return mockSoldAuctionsQuery;
        return mockAllListingsQuery;
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
  });

  it("should handle zero sold auctions (no avgSalePrice)", async () => {
    vi.mocked(users.findUserById).mockResolvedValue({
      _id: "auth123",
      userId: "user123",
      name: "New Seller",
      createdAt: Date.now(),
    } as unknown as Doc<"profiles">);

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

    const mockAllListingsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{}]),
    };

    const mockBidsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([{}]),
    };

    let queryCallCount = 0;
    mockCtx.db.query.mockImplementation((table: string) => {
      queryCallCount++;
      if (table === "profiles") return mockProfileQuery;
      if (table === "auctions") {
        if (queryCallCount === 2) return mockSoldAuctionsQuery;
        return mockAllListingsQuery;
      }
      if (table === "bids") return mockBidsQuery;
      return mockProfileQuery;
    });

    const result = await getSellerInfoHandler(mockCtx as unknown as QueryCtx, {
      sellerId: "user123",
    });

    expect(result).not.toBeNull();
    expect(result?.itemsSold).toBe(0);
    expect(result?.avgSalePrice).toBeUndefined();
    expect(result?.bidsPlaced).toBe(1);
  });
});
