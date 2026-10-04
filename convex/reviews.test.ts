import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import {
  submitReviewHandler,
  respondToReviewHandler,
  getSellerReviewsHandler,
  getSellerRatingSummary,
} from "./reviews";
import * as auth from "./lib/auth";
import { MAX_REVIEW_COMMENT_LENGTH, MAX_REVIEWS_PER_WINDOW } from "./constants";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

vi.mock("./lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

interface MockDb {
  get: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

type MockMutationCtx = {
  db: MockDb;
} & Partial<MutationCtx>;

type MockQueryCtx = {
  db: MockDb;
} & Partial<QueryCtx>;

/**
 * Chainable index-range builder used to run the index callbacks production code
 * hands to `withIndex`; Convex builds the range synchronously.
 */
interface MockIndexBuilder {
  eq: (field: string, value: unknown) => MockIndexBuilder;
  gte: (field: string, value: unknown) => MockIndexBuilder;
  lte: (field: string, value: unknown) => MockIndexBuilder;
}

const createIndexBuilder = (): MockIndexBuilder => {
  const builder: MockIndexBuilder = {
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
  };
  return builder;
};

/**
 * Replaces a query double's `withIndex` with one that runs the index callback
 * and returns the same query.
 *
 * @param query - Query double to attach the runner to
 * @returns The same query double
 */
const withIndexRunner = <T extends { withIndex: ReturnType<typeof vi.fn> }>(
  query: T
): T => {
  query.withIndex = vi.fn(
    (_indexName: string, cb?: (q: MockIndexBuilder) => unknown) => {
      if (cb) cb(createIndexBuilder());
      return query;
    }
  );
  return query;
};

describe("submitReview mutation", () => {
  let mockCtx: MockMutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = (
    options: {
      existingReview?: unknown;
      recentReviews?: unknown[];
      mockQuery?: unknown;
    } = {}
  ) => {
    const { existingReview = null, recentReviews = [] } = options;
    const baseMockQuery =
      options.mockQuery ??
      withIndexRunner({
        withIndex: vi.fn(),
        unique: vi.fn().mockResolvedValue(existingReview),
      });

    const mockDb: MockDb = {
      get: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
      query: vi.fn((table: string) => {
        if (table === "reviews") {
          return {
            withIndex: vi.fn(
              (indexName: string, cb?: (q: MockIndexBuilder) => unknown) => {
                if (cb) cb(createIndexBuilder());
                if (indexName === "by_reviewer_createdAt") {
                  return {
                    collect: vi.fn().mockResolvedValue(recentReviews),
                  };
                }
                if (indexName === "by_lot_reviewer") {
                  return {
                    unique: vi.fn().mockResolvedValue(existingReview),
                  };
                }
                return baseMockQuery;
              }
            ),
          };
        }
        return baseMockQuery;
      }),
    };
    return {
      db: mockDb,
    } as unknown as MockMutationCtx;
  };

  it("should allow the auction winner to submit a review for a sold auction", async () => {
    const lotId = "auction123" as Id<"lots">;
    const winnerId = "user_winner";
    const sellerId = "user_seller";

    const auctionDoc = {
      _id: lotId,
      sellerId,
      winnerId,
      status: "sold",
      settledAt: Date.now() - 8 * DAY_MS,
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    const result = await submitReviewHandler(
      mockCtx as unknown as MutationCtx,
      {
        lotId,
        rating: 5,
        comment: "Great tractor",
      }
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.insert).toHaveBeenCalledWith(
      "reviews",
      expect.objectContaining({
        lotId,
        reviewerId: winnerId,
        revieweeId: sellerId,
        rating: 5,
        comment: "Great tractor",
      })
    );
  });

  it("should throw if auction not found", async () => {
    const lotId = "nonexistent" as Id<"lots">;
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user123");

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        rating: 5,
      })
    ).rejects.toThrow(ConvexError);
  });

  it("should reject a non-winner", async () => {
    const lotId = "auction123" as Id<"lots">;

    const auctionDoc = {
      _id: lotId,
      sellerId: "user_seller",
      winnerId: "user_actual_winner",
      status: "sold",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_other");

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        rating: 5,
      })
    ).rejects.toThrow("Only the auction winner can leave a review");
  });

  it("should reject when the auction is not sold", async () => {
    const lotId = "auction123" as Id<"lots">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: lotId,
      sellerId: "user_seller",
      winnerId,
      status: "active",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        rating: 5,
      })
    ).rejects.toThrow("Auction is not completed");
  });

  it.each([0, 6, 3.5])("should reject invalid rating %s", async (rating) => {
    const lotId = "auction123" as Id<"lots">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: lotId,
      sellerId: "user_seller",
      winnerId,
      status: "sold",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        rating,
      })
    ).rejects.toThrow("Rating must be an integer between 1 and 5");
  });

  it("should reject a duplicate review by the same reviewer", async () => {
    const lotId = "auction123" as Id<"lots">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: lotId,
      sellerId: "user_seller",
      winnerId,
      status: "sold",
    };

    mockCtx = setupMockCtx({
      existingReview: { _id: "review1", rating: 4 },
    });
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        rating: 5,
      })
    ).rejects.toThrow("You have already reviewed this auction");
  });

  it("should reject a review within the 7-day cooldown after settlement", async () => {
    const lotId = "auction123" as Id<"lots">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: lotId,
      sellerId: "user_seller",
      winnerId,
      status: "sold",
      settledAt: Date.now() - 1 * DAY_MS,
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        rating: 5,
      })
    ).rejects.toThrow(
      "Reviews can be left starting 7 days after the sale completes."
    );
  });

  it("should accept a review at exactly 7 days after settlement", async () => {
    const lotId = "auction123" as Id<"lots">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: lotId,
      sellerId: "user_seller",
      winnerId,
      status: "sold",
      settledAt: Date.now() - 7 * DAY_MS,
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    const result = await submitReviewHandler(
      mockCtx as unknown as MutationCtx,
      { lotId, rating: 4 }
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.insert).toHaveBeenCalled();
  });

  it("should accept a review just over 7 days after settlement", async () => {
    const lotId = "auction123" as Id<"lots">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: lotId,
      sellerId: "user_seller",
      winnerId,
      status: "sold",
      settledAt: Date.now() - 7 * DAY_MS - 60_000,
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    const result = await submitReviewHandler(
      mockCtx as unknown as MutationCtx,
      { lotId, rating: 5 }
    );

    expect(result.success).toBe(true);
  });

  it("should allow a review for a sold auction with no settlement timestamp", async () => {
    const lotId = "auction123" as Id<"lots">;
    const winnerId = "user_winner";

    const auctionDoc = {
      _id: lotId,
      sellerId: "user_seller",
      winnerId,
      status: "sold",
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(auctionDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    const result = await submitReviewHandler(
      mockCtx as unknown as MutationCtx,
      { lotId, rating: 5 }
    );

    expect(result.success).toBe(true);
  });

  it("should reject a comment longer than the documented cap", async () => {
    const lotId = "auction123" as Id<"lots">;
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue({
      _id: lotId,
      sellerId: "user_seller",
      winnerId: "user_winner",
      status: "sold",
      settledAt: Date.now() - 8 * DAY_MS,
    });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_winner");

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        rating: 5,
        comment: "x".repeat(MAX_REVIEW_COMMENT_LENGTH + 1),
      })
    ).rejects.toThrow(
      `Comment is too long. Maximum ${MAX_REVIEW_COMMENT_LENGTH.toString()} characters allowed.`
    );
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
  });

  it("should reject once the reviewer hits the window rate limit", async () => {
    const lotId = "auction123" as Id<"lots">;
    mockCtx = setupMockCtx({
      recentReviews: Array.from({ length: MAX_REVIEWS_PER_WINDOW }, (_, i) => ({
        _id: `rev${String(i)}`,
      })),
    });
    mockCtx.db.get.mockResolvedValue({
      _id: lotId,
      sellerId: "user_seller",
      winnerId: "user_winner",
      status: "sold",
      settledAt: Date.now() - 8 * DAY_MS,
    });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_winner");

    await expect(
      submitReviewHandler(mockCtx as unknown as MutationCtx, {
        lotId,
        rating: 5,
      })
    ).rejects.toThrow("You're submitting reviews too quickly");
    expect(mockCtx.db.insert).not.toHaveBeenCalled();
  });

  it("scopes the duplicate and rate-limit lookups to the reviewer", async () => {
    const lotId = "auction123" as Id<"lots">;
    const winnerId = "user_winner";

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue({
      _id: lotId,
      sellerId: "user_seller",
      winnerId,
      status: "sold",
      settledAt: Date.now() - 8 * DAY_MS,
    });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue(winnerId);

    await submitReviewHandler(mockCtx as unknown as MutationCtx, {
      lotId,
      rating: 4,
    });

    const indexNames = (
      mockCtx.db.query as unknown as ReturnType<typeof vi.fn>
    ).mock.results.flatMap((r) => {
      const query = r.value as { withIndex?: ReturnType<typeof vi.fn> };
      return (query.withIndex?.mock.calls ?? []).map(
        (call) => call[0] as string
      );
    });
    expect(indexNames).toEqual(
      expect.arrayContaining(["by_reviewer_createdAt", "by_lot_reviewer"])
    );
  });
});

describe("respondToReview mutation", () => {
  let mockCtx: MockMutationCtx;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setupMockCtx = () => {
    const mockDb: MockDb = {
      get: vi.fn(),
      insert: vi.fn(),
      patch: vi.fn(),
      query: vi.fn(),
    };
    return {
      db: mockDb,
    } as unknown as MockMutationCtx;
  };

  it("should allow the reviewed seller to respond to a review", async () => {
    const reviewId = "review123" as Id<"reviews">;

    const reviewDoc = {
      _id: reviewId,
      reviewerId: "user_buyer",
      revieweeId: "user_seller",
      rating: 4,
      response: undefined,
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(reviewDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_seller");

    const result = await respondToReviewHandler(
      mockCtx as unknown as MutationCtx,
      { reviewId, text: "Thank you for the purchase!" }
    );

    expect(result.success).toBe(true);
    expect(mockCtx.db.patch).toHaveBeenCalledWith("reviews", reviewId, {
      response: {
        text: "Thank you for the purchase!",
        createdAt: expect.any(Number) as number,
      },
    });
  });

  it("should throw if review not found", async () => {
    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(null);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_seller");

    await expect(
      respondToReviewHandler(mockCtx as unknown as MutationCtx, {
        reviewId: "nonexistent" as Id<"reviews">,
        text: "Thanks",
      })
    ).rejects.toThrow("Review not found");
  });

  it("should reject a response longer than the documented cap", async () => {
    const reviewId = "review123" as Id<"reviews">;

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue({
      _id: reviewId,
      reviewerId: "user_buyer",
      revieweeId: "user_seller",
      rating: 4,
      response: undefined,
    });
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_seller");

    await expect(
      respondToReviewHandler(mockCtx as unknown as MutationCtx, {
        reviewId,
        text: "x".repeat(MAX_REVIEW_COMMENT_LENGTH + 1),
      })
    ).rejects.toThrow(
      `Response is too long. Maximum ${MAX_REVIEW_COMMENT_LENGTH.toString()} characters allowed.`
    );
    expect(mockCtx.db.patch).not.toHaveBeenCalled();
  });

  it("should reject a caller who is not the reviewed seller", async () => {
    const reviewId = "review123" as Id<"reviews">;

    const reviewDoc = {
      _id: reviewId,
      reviewerId: "user_buyer",
      revieweeId: "user_seller",
      rating: 4,
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(reviewDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_other");

    await expect(
      respondToReviewHandler(mockCtx as unknown as MutationCtx, {
        reviewId,
        text: "Thanks",
      })
    ).rejects.toThrow("Only the reviewed seller can respond to this review");
  });

  it("should reject a second response to the same review", async () => {
    const reviewId = "review123" as Id<"reviews">;

    const reviewDoc = {
      _id: reviewId,
      reviewerId: "user_buyer",
      revieweeId: "user_seller",
      rating: 4,
      response: { text: "Already replied", createdAt: 1000 },
    };

    mockCtx = setupMockCtx();
    mockCtx.db.get.mockResolvedValue(reviewDoc);
    vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_seller");

    await expect(
      respondToReviewHandler(mockCtx as unknown as MutationCtx, {
        reviewId,
        text: "Another reply",
      })
    ).rejects.toThrow("This review has already been responded to");
  });

  it.each(["", "   "])(
    "should reject blank or whitespace-only response text %s",
    async (text) => {
      const reviewId = "review123" as Id<"reviews">;

      const reviewDoc = {
        _id: reviewId,
        reviewerId: "user_buyer",
        revieweeId: "user_seller",
        rating: 4,
      };

      mockCtx = setupMockCtx();
      mockCtx.db.get.mockResolvedValue(reviewDoc);
      vi.mocked(auth.getAuthenticatedUserId).mockResolvedValue("user_seller");

      await expect(
        respondToReviewHandler(mockCtx as unknown as MutationCtx, {
          reviewId,
          text,
        })
      ).rejects.toThrow("Response text cannot be empty");
    }
  );
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
      patch: vi.fn(),
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
        lotId: "auction1",
        reviewerId: "user1",
        revieweeId: "seller1",
        rating: 5,
        comment: "Excellent",
        createdAt: 1000,
        response: { text: "Thank you!", createdAt: 1500 },
      },
      {
        _id: "review2",
        _creationTime: 200,
        lotId: "auction2",
        reviewerId: "user2",
        revieweeId: "seller1",
        rating: 4,
        createdAt: 2000,
      },
    ];

    const mockReviewsQuery = withIndexRunner({
      withIndex: vi.fn(),
      order: vi.fn().mockReturnThis(),
      paginate: vi.fn().mockResolvedValue({
        page: reviewsPage,
        isDone: true,
        continueCursor: "",
      }),
    });

    const mockProfilesQuery = withIndexRunner({
      withIndex: vi.fn(),
      unique: vi
        .fn()
        .mockResolvedValueOnce({ userId: "user1", name: "Buyer One" })
        .mockResolvedValueOnce({ userId: "user2", name: "Buyer Two" }),
    });

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
      lotId: "auction1",
      rating: 5,
      comment: "Excellent",
      createdAt: 1000,
      reviewerName: "Buyer One",
      response: { text: "Thank you!", createdAt: 1500 },
    });
    expect(result.page[1]?.reviewerName).toBe("Buyer Two");
    expect(result.page[1]?.response).toBeUndefined();
    expect(result.isDone).toBe(true);
    expect(result.continueCursor).toBe("");
  });

  it("should fall back to no reviewer name when the profile is missing", async () => {
    const reviewsPage = [
      {
        _id: "review1",
        _creationTime: 100,
        lotId: "auction1",
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
      patch: vi.fn(),
      query: vi.fn(() => mockQuery),
    };
    return {
      db: mockDb,
    } as unknown as MockQueryCtx;
  };

  it("should compute the average rating and count", async () => {
    const collect = vi
      .fn()
      .mockResolvedValue([{ rating: 5 }, { rating: 4 }, { rating: 3 }]);
    const indexBuilder = { eq: vi.fn(() => indexBuilder) };
    const mockQuery = {
      withIndex: vi.fn((_index: string, cb?: (q: unknown) => unknown) => {
        if (cb) cb(indexBuilder);
        return mockQuery;
      }),
      collect,
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
    expect(indexBuilder.eq).toHaveBeenCalledWith("revieweeId", "seller1");
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
