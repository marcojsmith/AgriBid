import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  submitReviewHandler,
  getSellerReviewsHandler,
  getSellerRatingSummary,
} from "./reviews";
import * as auth from "./lib/auth";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

vi.mock("./lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
}));

type MockDb = {
  get: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
};

type MockMutationCtx = {
  db: MockDb;
} & Partial<MutationCtx>;

type MockQueryCtx = {
  db: MockDb;
} & Partial<QueryCtx>;

describe("submitReview mutation", () => {
  let mockCtx: MockMutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: unknown = {}) => {
    const mockDb: MockDb = {
      get: vi.fn(),
      insert: vi.fn(),
      query: vi.fn(() => mockQuery),
    };
    return {
      db: mockDb,
    } as unknown as MockMutationCtx;
  };

  it("should allow the auction winner to submit a review for a sold auction", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const winnerId = "user_winner";
    const sellerId = "user_seller";

    const auctionDoc = {
      _id: auctionId,
      sellerId,
      winnerId,
      status: "sold",
    };

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(null), // No existing review
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    const result = await submitReviewHandler(
      mockCtx as unknown as MutationCtx,
      {
        auctionId,
        rating: 5,
        comment: "Great tractor",
      }
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "reviews",
      expect.objectContaining({
        auctionId,
        reviewerId: winnerId,
        revieweeId: sellerId,
        rating: 5,
        comment: "Great tractor",
      })
    );
  });

  it("should throw if auction not found", async () => {
    const auctionId = "nonexistent" as Id<"auctions">;
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        auctionId,
        rating: 5,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should reject a non-winner", async () => {
    const auctionId = "auction123" as Id<"auctions">;

    const auctionDoc = {
      _id: auctionId,
      sellerId: "user_seller",
      winnerId: "user_actual_winner",
      status: "sold",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_other");

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        auctionId,
        rating: 5,
      })
    ).rejects.toThrow("Only the auction winner can leave a review");
  });

  it("should reject when the auction is not sold", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: auctionId,
      sellerId: "user_seller",
      winnerId,
      status: "active",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        auctionId,
        rating: 5,
      })
    ).rejects.toThrow("Auction is not completed");
  });

  it.each([0, 6, 3.5])("should reject invalid rating %s", async (rating) => {
    const auctionId = "auction123" as Id<"auctions">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: auctionId,
      sellerId: "user_seller",
      winnerId,
      status: "sold",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        auctionId,
        rating,
      })
    ).rejects.toThrow("Rating must be an integer between 1 and 5");
  });

  it("should reject a duplicate review by the same reviewer", async () => {
    const auctionId = "auction123" as Id<"auctions">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: auctionId,
      sellerId: "user_seller",
      winnerId,
      status: "sold",
    };

    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue({ _id: "review1", rating: 4 }),
    };

    mockCtx = setupMockCtx(mockQuery);
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        auctionId,
        rating: 5,
      })
    ).rejects.toThrow("You have already reviewed this auction");
  });
});

describe("getSellerReviews query", () => {
  let mockCtx: MockQueryCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    const mockDb: MockDb = {
      get: vi.fn(),
      insert: vi.fn(),
      query: vi.fn(),
    };
    return {
      db: mockDb,
    } as unknown as MockQueryCtx;
  };

  it("should return paginated reviews with reviewer names", async () => {
    const reviewsPage = [
      {
        _id: "review1",
        _creationTime: 100,
        auctionId: "auction1",
        reviewerId: "user1",
        revieweeId: "seller1",
        rating: 5,
        comment: "Excellent",
        createdAt: 1000,
      },
      {
        _id: "review2",
        _creationTime: 200,
        auctionId: "auction2",
        reviewerId: "user2",
        revieweeId: "seller1",
        rating: 4,
        createdAt: 2000,
      },
    ];

    const mockReviewsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      paginate: vi.fn().mockResolvedValue({
        page: reviewsPage,
        isDone: true,
        continueCursor: "",
      }),
    };

    const mockProfilesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi
        .fn()
        .mockResolvedValueOnce({ userId: "user1", name: "Buyer One" })
        .mockResolvedValueOnce({ userId: "user2", name: "Buyer Two" }),
    };

    mockCtx = setupMockCtx();
    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "reviews") return mockReviewsQuery;
      if (table === "profiles") return mockProfilesQuery;
      throw new Error(`Unexpected table queried: ${table}`);
    });

    const result = await getSellerReviewsHandler(
      mockCtx as unknown as QueryCtx,
      { sellerId: "seller1", paginationOpts: { numItems: 10, cursor: null } }
    );

    expect(mockReviewsQuery.withIndex).toHaveBeenCalledWith(
      "by_reviewee_createdAt",
      expect.any(Function)
    );
    expect(result.page).toHaveLength(2);
    expect(result.page[0]).toEqual({
      _id: "review1",
      _creationTime: 100,
      auctionId: "auction1",
      rating: 5,
      comment: "Excellent",
      createdAt: 1000,
      reviewerName: "Buyer One",
    });
    expect(result.page[1]?.reviewerName).toBe("Buyer Two");
    expect(result.isDone).toBe(true);
    expect(result.continueCursor).toBe("");
  });

  it("should fall back to no reviewer name when the profile is missing", async () => {
    const reviewsPage = [
      {
        _id: "review1",
        _creationTime: 100,
        auctionId: "auction1",
        reviewerId: "ghost_user",
        revieweeId: "seller1",
        rating: 3,
        createdAt: 1000,
      },
    ];

    const mockReviewsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      paginate: vi.fn().mockResolvedValue({
        page: reviewsPage,
        isDone: true,
        continueCursor: "",
      }),
    };

    const mockProfilesQuery = {
      withIndex: vi.fn().mockReturnThis(),
      unique: vi.fn().mockResolvedValue(null),
    };

    mockCtx = setupMockCtx();
    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "reviews") return mockReviewsQuery;
      if (table === "profiles") return mockProfilesQuery;
      throw new Error(`Unexpected table queried: ${table}`);
    });

    const result = await getSellerReviewsHandler(
      mockCtx as unknown as QueryCtx,
      { sellerId: "seller1", paginationOpts: { numItems: 10, cursor: null } }
    );

    expect(result.page).toHaveLength(1);
    expect(result.page[0]?.reviewerName).toBeUndefined();
  });

  it("should return an empty page for a seller with no reviews", async () => {
    const mockReviewsQuery = {
      withIndex: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      paginate: vi.fn().mockResolvedValue({
        page: [],
        isDone: true,
        continueCursor: "",
      }),
    };

    mockCtx = setupMockCtx();
    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "reviews") return mockReviewsQuery;
      throw new Error(`Unexpected table queried: ${table}`);
    });

    const result = await getSellerReviewsHandler(
      mockCtx as unknown as QueryCtx,
      { sellerId: "seller1", paginationOpts: { numItems: 10, cursor: null } }
    );

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
    expect(result.continueCursor).toBe("");
  });
});

describe("getSellerRatingSummary", () => {
  let mockCtx: MockQueryCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (mockQuery: unknown) => {
    const mockDb: MockDb = {
      get: vi.fn(),
      insert: vi.fn(),
      query: vi.fn(() => mockQuery),
    };
    return {
      db: mockDb,
    } as unknown as MockQueryCtx;
  };

  it("should compute the average rating and count", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi
        .fn()
        .mockResolvedValue([{ rating: 5 }, { rating: 4 }, { rating: 3 }]),
    };

    mockCtx = setupMockCtx(mockQuery);

    const result = await getSellerRatingSummary(
      mockCtx as unknown as QueryCtx,
      "seller1"
    );

    expect(mockQuery.withIndex).toHaveBeenCalledWith(
      "by_reviewee",
      expect.any(Function)
    );
    expect(result).toEqual({ avgRating: 4, reviewCount: 3 });
  });

  it("should return undefined avgRating when there are no reviews", async () => {
    const mockQuery = {
      withIndex: vi.fn().mockReturnThis(),
      collect: vi.fn().mockResolvedValue([]),
    };

    mockCtx = setupMockCtx(mockQuery);

    const result = await getSellerRatingSummary(
      mockCtx as unknown as QueryCtx,
      "seller1"
    );

    expect(result).toEqual({ avgRating: undefined, reviewCount: 0 });
  });
});
