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
 * Only the auction winner may review, and only once per auction.
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
 * Only the auction winner can review, once per auction.
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
 * Returns a paginated page of reviews for a seller, newest first,
 * with the reviewer's display name attached when available.
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
        createdAt: v.number(),
        reviewerName: v.optional(v.string()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: getSellerReviewsHandler,
});
