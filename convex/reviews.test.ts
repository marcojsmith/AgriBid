import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import { submitReviewHandler, respondToReviewHandler } from "./reviews";
import * as auth from "./lib/auth";
import { MAX_REVIEW_COMMENT_LENGTH, MAX_REVIEWS_PER_WINDOW } from "./constants";
import type { MutationCtx } from "./_generated/server";
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
