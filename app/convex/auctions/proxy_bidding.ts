// app/convex/auctions/proxy_bidding.ts
import { v } from "convex/values";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Gets the current proxy bid for the authenticated user on an auction.
 */
export const getMyProxyBid = query({
  args: { auctionId: v.id("auctions") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("proxy_bids"),
      _creationTime: v.number(),
      auctionId: v.id("auctions"),
      bidderId: v.string(),
      maxBid: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return null;
    const userId = authUser.userId ?? authUser._id;

    return await ctx.db
      .query("proxy_bids")
      .withIndex("by_bidder_auction", (q) =>
        q.eq("bidderId", userId).eq("auctionId", args.auctionId)
      )
      .unique();
  },
});

/**
 * Calculates the minimum increment for an auction based on its price.
 *
 * @param auction - The auction document
 * @returns The minimum increment amount
 */
export function getMinIncrement(auction: Doc<"auctions">): number {
  return auction.minIncrement || (auction.startingPrice < 10000 ? 100 : 500);
}

/**
 * Gets the current highest valid bid for an auction.
 *
 * @param ctx - Query or Mutation context
 * @param auctionId - ID of the auction
 * @returns The highest bid document or null if no bids
 */
export async function getCurrentHighestBid(
  ctx: QueryCtx | MutationCtx,
  auctionId: Id<"auctions">
): Promise<Doc<"bids"> | null> {
  return await ctx.db
    .query("bids")
    .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
    .order("desc")
    .filter((q) => q.neq(q.field("status"), "voided"))
    .first();
}

/**
 * Gets the current highest bid amount for an auction.
 *
 * @param ctx - Query or Mutation context
 * @param auctionId - ID of the auction
 * @returns The highest bid amount
 */
export async function getCurrentHighestBidAmount(
  ctx: QueryCtx | MutationCtx,
  auctionId: Id<"auctions">
): Promise<number> {
  const auction = await ctx.db.get(auctionId);
  if (!auction) return 0;

  const highestBid = await getCurrentHighestBid(ctx, auctionId);
  return highestBid ? highestBid.amount : auction.currentPrice;
}

/**
 * Handles the logic for when a new bid is placed, including proxy bidding.
 *
 * @param ctx - Mutation context
 * @param auctionId - ID of the auction
 * @param bidderId - ID of the bidder (userId)
 * @param bidAmount - Amount of the new bid
 * @param maxBid - Optional max bid for proxy bidding
 * @returns Information about the bid result
 */
export async function handleNewBid(
  ctx: MutationCtx,
  auctionId: Id<"auctions">,
  bidderId: string,
  bidAmount: number,
  maxBid?: number
) {
  const auction = await ctx.db.get(auctionId);
  if (!auction) throw new Error("Auction not found");

  const currentHighest = await getCurrentHighestBidAmount(ctx, auctionId);
  const minIncrement = getMinIncrement(auction);

  // 1. Basic Validation
  if (bidAmount <= currentHighest && currentHighest > 0) {
    // If it's the very first bid, it must be >= startingPrice (currentPrice)
    // Actually currentPrice is initialized to startingPrice.
    if (bidAmount < auction.currentPrice) {
      throw new Error(`Bid amount must be at least R${auction.currentPrice}`);
    }
  } else if (bidAmount < currentHighest + minIncrement && currentHighest > 0) {
    throw new Error(
      `Bid amount must be at least R${currentHighest + minIncrement}`
    );
  }

  // 2. Upsert Proxy Bid if provided
  if (maxBid !== undefined) {
    const existingProxy = await ctx.db
      .query("proxy_bids")
      .withIndex("by_bidder_auction", (q) =>
        q.eq("bidderId", bidderId).eq("auctionId", auctionId)
      )
      .unique();

    if (existingProxy) {
      await ctx.db.patch(existingProxy._id, {
        maxBid,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("proxy_bids", {
        auctionId,
        bidderId,
        maxBid,
        updatedAt: Date.now(),
      });
    }
  }

  // 3. Place the manual bid
  await ctx.db.insert("bids", {
    auctionId,
    bidderId,
    amount: bidAmount,
    timestamp: Date.now(),
    status: "valid",
  });

  // 4. Update Auction Price and handle Soft Close
  let newEndTime = auction.endTime;
  let isExtended = auction.isExtended || false;
  const now = Date.now();

  if (auction.endTime && auction.endTime - now < 120000) {
    // 2 minutes
    newEndTime = now + 120000;
    isExtended = true;
  }

  await ctx.db.patch(auctionId, {
    currentPrice: bidAmount,
    endTime: newEndTime,
    isExtended,
  });

  // 5. Trigger Proxy Bidding for OTHER users
  // Find other proxy bids that might want to outbid this new bid
  const otherProxyBids = await ctx.db
    .query("proxy_bids")
    .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
    .filter((q) => q.neq(q.field("bidderId"), bidderId))
    .collect();

  // Sort other proxy bids by maxBid desc
  const sortedOtherProxies = otherProxyBids.sort((a, b) => b.maxBid - a.maxBid);

  if (sortedOtherProxies.length > 0) {
    const highestOtherProxy = sortedOtherProxies[0];

    if (highestOtherProxy.maxBid > bidAmount) {
      // Someone else has a proxy bid that is higher than this new bid.
      // They should automatically outbid this person.
      let autoBidAmount = bidAmount + minIncrement;
      if (autoBidAmount > highestOtherProxy.maxBid) {
        autoBidAmount = highestOtherProxy.maxBid;
      }

      // Recursively (or just once for now) place the auto-bid
      await ctx.db.insert("bids", {
        auctionId,
        bidderId: highestOtherProxy.bidderId,
        amount: autoBidAmount,
        timestamp: Date.now() + 1,
        status: "valid",
      });

      await ctx.db.patch(auctionId, {
        currentPrice: autoBidAmount,
      });

      return {
        success: true,
        bidAmount: autoBidAmount,
        isProxyBid: true,
        nextBidAmount: null, // No next bid for the current caller as they were outbid
      };
    }
  }

  return {
    success: true,
    bidAmount: bidAmount,
    isProxyBid: false,
    nextBidAmount:
      maxBid !== undefined && maxBid > bidAmount
        ? bidAmount + minIncrement
        : null,
  };
}

/**
 * Gets the current proxy bid for a user on an auction.
 */
export async function getProxyBid(
  ctx: QueryCtx,
  auctionId: Id<"auctions">,
  userId: string
): Promise<Doc<"proxy_bids"> | null> {
  return await ctx.db
    .query("proxy_bids")
    .withIndex("by_bidder_auction", (q) =>
      q.eq("bidderId", userId).eq("auctionId", auctionId)
    )
    .unique();
}
