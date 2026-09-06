// app/convex/reviews.ts
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { PaginationOptions } from "convex/server";

import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthenticatedUserId } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

/** Cooldown after auction settlement before a review can be left (7 days). */
const REVIEW_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Computes the average rating and review count for a seller.
 *
 * Plain helper (not a registered function) so it can run inside the same
 * query transaction as other handlers without an extra round trip.
 *
 * @param ctx - Convex Query context
 * @param sellerId - The seller user ID to summarise reviews for
 * @returns The average rating (undefined when unreviewed) and review count
 */
export async function getSellerRatingSummary(
  ctx: QueryCtx,
  sellerId: string
): Promise<{ avgRating: number | undefined; reviewCount: number }> {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_reviewee", (q) => q.eq("revieweeId", sellerId))
    .collect();
  const reviewCount = reviews.length;
  const avgRating =
    reviewCount > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : undefined;
  return { avgRating, reviewCount };
}

/**
 * Handler for submitting a review for a completed auction.
 * Only the auction winner may review, and only once per auction, no
 * earlier than 7 days after the auction was settled.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId, rating, and optional comment
 * @param args.auctionId - The ID of the auction to review
 * @param args.rating - Integer rating between 1 and 5
 * @param args.comment - Optional review comment
 * @returns Object with success boolean
 */
export const submitReviewHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId: Id<"auctions">;
    rating: number;
    comment?: string;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  if (auction.winnerId !== userId) {
    throw new ConvexError("Only the auction winner can leave a review");
  }

  if (auction.status !== "sold") {
    throw new ConvexError("Auction is not completed");
  }

  const settledAt = auction.settledAt ?? auction.endTime;
  if (settledAt !== undefined && Date.now() - settledAt < REVIEW_COOLDOWN_MS) {
    throw new ConvexError(
      "Reviews can be left starting 7 days after the sale completes."
    );
  }

  if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
    throw new ConvexError("Rating must be an integer between 1 and 5");
  }

  const existingReview = await ctx.db
    .query("reviews")
    .withIndex("by_auction_reviewer", (q) =>
      q.eq("auctionId", args.auctionId).eq("reviewerId", userId)
    )
    .unique();

  if (existingReview) {
    throw new ConvexError("You have already reviewed this auction");
  }

  await ctx.db.insert("reviews", {
    auctionId: args.auctionId,
    reviewerId: userId,
    revieweeId: auction.sellerId,
    rating: args.rating,
    comment: args.comment,
    createdAt: Date.now(),
  });

  return { success: true };
};

/**
 * Submit a review for a completed auction.
 * Only the auction winner can review, once per auction, and only from
 * 7 days after the auction was settled.
 */
export const submitReview = mutation({
  args: {
    auctionId: v.id("auctions"),
    rating: v.number(),
    comment: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: submitReviewHandler,
});

/**
 * Handler for a seller responding to a review left about them.
 * Only the reviewed seller may respond, once per review, with non-empty text.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including reviewId and response text
 * @param args.reviewId - The ID of the review to respond to
 * @param args.text - The response text (must be non-blank)
 * @returns Object with success boolean
 */
export const respondToReviewHandler = async (
  ctx: MutationCtx,
  args: { reviewId: Id<"reviews">; text: string }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const review = await ctx.db.get(args.reviewId);
  if (!review) {
    throw new ConvexError("Review not found");
  }

  if (review.revieweeId !== userId) {
    throw new ConvexError(
      "Only the reviewed seller can respond to this review"
    );
  }

  if (review.response) {
    throw new ConvexError("This review has already been responded to");
  }

  if (args.text.trim().length === 0) {
    throw new ConvexError("Response text cannot be empty");
  }

  await ctx.db.patch(args.reviewId, {
    response: { text: args.text, createdAt: Date.now() },
  });

  return { success: true };
};

/**
 * Respond to a review as the reviewed seller.
 * One response per review; responses cannot be edited or removed.
 */
export const respondToReview = mutation({
  args: {
    reviewId: v.id("reviews"),
    text: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: respondToReviewHandler,
});

/**
 * Returns a paginated page of reviews for a seller, newest first,
 * with the reviewer's display name and the seller's response (if any) attached.
 *
 * @param ctx - Convex Query context
 * @param args - Query arguments
 * @param args.sellerId - The seller user ID to fetch reviews for
 * @param args.paginationOpts - Pagination options
 * @returns Paginated reviews with reviewer names
 */
export const getSellerReviewsHandler = async (
  ctx: QueryCtx,
  args: { sellerId: string; paginationOpts: PaginationOptions }
) => {
  const results = await ctx.db
    .query("reviews")
    .withIndex("by_reviewee_createdAt", (q) =>
      q.eq("revieweeId", args.sellerId)
    )
    .order("desc")
    .paginate(args.paginationOpts);

  const page = await Promise.all(
    results.page.map(async (review) => {
      const reviewerProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", review.reviewerId))
        .unique();

      return {
        _id: review._id,
        _creationTime: review._creationTime,
        auctionId: review.auctionId,
        rating: review.rating,
        comment: review.comment,
        response: review.response,
        createdAt: review.createdAt,
        reviewerName: reviewerProfile?.name,
      };
    })
  );

  return {
    page,
    isDone: results.isDone,
    continueCursor: results.continueCursor,
  };
};

/**
 * Query: Get paginated reviews for a seller.
 * Args: sellerId, paginationOpts
 *
 * @returns Paginated reviews with reviewer names
 */
export const getSellerReviews = query({
  args: {
    sellerId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("reviews"),
        _creationTime: v.number(),
        auctionId: v.id("auctions"),
        rating: v.number(),
        comment: v.optional(v.string()),
        response: v.optional(
          v.object({ text: v.string(), createdAt: v.number() })
        ),
        createdAt: v.number(),
        reviewerName: v.optional(v.string()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: getSellerReviewsHandler,
});
