// app/convex/auctions/proxy_bidding.ts
import { v } from "convex/values";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Constants for auction logic.
 */
const SOFT_CLOSE_THRESHOLD_MS = 120000; // 2 minutes
const AUTO_BID_TIMESTAMP_OFFSET = 1; // Ensure auto-bid is chronologically after the manual bid
const PRICE_THRESHOLD_FOR_SMALL_INCREMENT = 10000;
const SMALL_INCREMENT_AMOUNT = 100;
const LARGE_INCREMENT_AMOUNT = 500;

/**
 * Result shape for the handleNewBid function.
 */
export type HandleNewBidResult = {
  success: boolean;
  bidAmount: number;
  isProxyBid: boolean;
  nextBidAmount: number | null;
  proxyBidActive: boolean;
  confirmedMaxBid?: number;
};

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
  return (
    auction.minIncrement ||
    (auction.startingPrice < PRICE_THRESHOLD_FOR_SMALL_INCREMENT
      ? SMALL_INCREMENT_AMOUNT
      : LARGE_INCREMENT_AMOUNT)
  );
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
  if (!auction) {
    throw new Error(`Auction ${auctionId} not found`);
  }

  const highestBid = await getCurrentHighestBid(ctx, auctionId);
  return highestBid ? highestBid.amount : auction.currentPrice;
}

/**
 * Validates a potential bid against auction rules.
 */
async function validateBid(
  ctx: MutationCtx,
  auction: Doc<"auctions">,
  bidAmount: number,
  maxBid?: number
) {
  const highestBidDoc = await getCurrentHighestBid(ctx, auction._id);
  const minIncrement = getMinIncrement(auction);

  // 1. Basic Price Validation
  if (!highestBidDoc) {
    if (bidAmount < auction.currentPrice) {
      throw new Error(`First bid must be at least R${auction.currentPrice}`);
    }
  } else {
    if (bidAmount < auction.currentPrice + minIncrement) {
      throw new Error(
        `Bid amount must be at least R${auction.currentPrice + minIncrement}`
      );
    }
  }

  // 2. Proxy Validation
  if (maxBid !== undefined && maxBid < bidAmount) {
    throw new Error(
      "Proxy maximum bid must be at least the current bid amount."
    );
  }
}

/**
 * Creates or updates a proxy bid for a user.
 */
async function upsertProxyBid(
  ctx: MutationCtx,
  auctionId: Id<"auctions">,
  bidderId: string,
  maxBid: number
) {
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

/**
 * Extends the auction endTime if within the soft-close threshold.
 */
async function extendAuctionIfNeeded(
  ctx: MutationCtx,
  auction: Doc<"auctions">,
  now: number
) {
  if (auction.endTime && auction.endTime - now < SOFT_CLOSE_THRESHOLD_MS) {
    await ctx.db.patch(auction._id, {
      endTime: now + SOFT_CLOSE_THRESHOLD_MS,
      isExtended: true,
    });
  }
}

/**
 * Validates an auto-bid amount to ensure it meets requirements.
 */
function validateAutoBidAmount(
  autoBidAmount: number,
  currentBidAmount: number,
  minIncrement: number,
  maxBidLimit: number
): number | null {
  // If the computed amount is less than required, try to use the max bid limit
  if (autoBidAmount < currentBidAmount + minIncrement) {
    if (maxBidLimit >= currentBidAmount + minIncrement) {
      return maxBidLimit;
    }
    return null; // Cannot meet minimum increment
  }
  return autoBidAmount;
}

/**
 * Resolves all active proxy bids for an auction after a new bid is placed.
 */
async function resolveProxyBids(
  ctx: MutationCtx,
  auctionId: Id<"auctions">,
  bidderId: string,
  bidAmount: number
): Promise<HandleNewBidResult | null> {
  const auction = await ctx.db.get(auctionId);
  if (!auction) throw new Error("Auction not found");

  const minIncrement = getMinIncrement(auction);
  const allProxyBids = await ctx.db
    .query("proxy_bids")
    .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
    .collect();

  // Sort by maxBid descending, then by creationTime ascending (earliest bidder wins tie)
  const sortedProxies = allProxyBids.sort((a, b) => {
    if (b.maxBid !== a.maxBid) return b.maxBid - a.maxBid;
    return a._creationTime - b._creationTime;
  });

  if (sortedProxies.length === 0) return null;

  const highestProxy = sortedProxies[0];
  const secondHighestProxy = sortedProxies[1] || null;

  // Case A: Someone else has a proxy that outbids the current manual bid
  if (highestProxy.bidderId !== bidderId && highestProxy.maxBid > bidAmount) {
    let targetAmount = bidAmount + minIncrement;
    if (secondHighestProxy) {
      targetAmount = Math.max(
        targetAmount,
        secondHighestProxy.maxBid + minIncrement
      );
    }
    targetAmount = Math.min(targetAmount, highestProxy.maxBid);

    const validatedAmount = validateAutoBidAmount(
      targetAmount,
      bidAmount,
      minIncrement,
      highestProxy.maxBid
    );

    if (validatedAmount) {
      await ctx.db.insert("bids", {
        auctionId,
        bidderId: highestProxy.bidderId,
        amount: validatedAmount,
        timestamp: Date.now() + AUTO_BID_TIMESTAMP_OFFSET,
        status: "valid",
      });

      await ctx.db.patch(auctionId, { currentPrice: validatedAmount });

      return {
        success: true,
        bidAmount: validatedAmount,
        isProxyBid: true,
        nextBidAmount: null,
        proxyBidActive: false,
        confirmedMaxBid: undefined,
      };
    }
  }

  // Case B: The current manual bidder is the highest proxy
  if (
    highestProxy.bidderId === bidderId &&
    secondHighestProxy &&
    secondHighestProxy.maxBid >= bidAmount
  ) {
    const targetAmount = Math.min(
      highestProxy.maxBid,
      secondHighestProxy.maxBid + minIncrement
    );
    const validatedAmount = validateAutoBidAmount(
      targetAmount,
      bidAmount,
      minIncrement,
      highestProxy.maxBid
    );

    if (validatedAmount && validatedAmount > bidAmount) {
      await ctx.db.insert("bids", {
        auctionId,
        bidderId: highestProxy.bidderId,
        amount: validatedAmount,
        timestamp: Date.now() + AUTO_BID_TIMESTAMP_OFFSET,
        status: "valid",
      });

      await ctx.db.patch(auctionId, { currentPrice: validatedAmount });

      return {
        success: true,
        bidAmount: validatedAmount,
        isProxyBid: true,
        nextBidAmount:
          highestProxy.maxBid > validatedAmount
            ? validatedAmount + minIncrement
            : null,
        proxyBidActive: highestProxy.maxBid > validatedAmount,
        confirmedMaxBid: highestProxy.maxBid,
      };
    }
  }

  return null;
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
): Promise<HandleNewBidResult> {
  const auction = await ctx.db.get(auctionId);
  if (!auction) throw new Error("Auction not found");

  // 1. Validation
  await validateBid(ctx, auction, bidAmount, maxBid);
  const minIncrement = getMinIncrement(auction);

  // 2. Proxy Bid Update
  if (maxBid !== undefined) {
    await upsertProxyBid(ctx, auctionId, bidderId, maxBid);
  }

  // 3. Manual Bid Placement
  const now = Date.now();
  await ctx.db.insert("bids", {
    auctionId,
    bidderId,
    amount: bidAmount,
    timestamp: now,
    status: "valid",
  });

  // 4. Update Auction Price and handle Soft Close
  await ctx.db.patch(auctionId, { currentPrice: bidAmount });
  await extendAuctionIfNeeded(ctx, auction, now);

  // 5. Proxy Resolution
  const proxyResult = await resolveProxyBids(
    ctx,
    auctionId,
    bidderId,
    bidAmount
  );
  if (proxyResult) return proxyResult;

  return {
    success: true,
    bidAmount: bidAmount,
    isProxyBid: false,
    nextBidAmount:
      maxBid !== undefined && maxBid > bidAmount
        ? bidAmount + minIncrement
        : null,
    proxyBidActive: maxBid !== undefined && maxBid > bidAmount,
    confirmedMaxBid: maxBid,
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
