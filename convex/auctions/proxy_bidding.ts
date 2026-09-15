// app/convex/auctions/proxy_bidding.ts
import { v } from "convex/values";

import { query } from "../_generated/server";
import { getAuthUser } from "../lib/auth";
import {
  SOFT_CLOSE_THRESHOLD_MS,
  PRICE_THRESHOLD_FOR_INCREMENT,
  SMALL_INCREMENT_AMOUNT,
  LARGE_INCREMENT_AMOUNT,
} from "../constants";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

const AUTO_BID_TIMESTAMP_OFFSET = 1; // Ensure auto-bid is chronologically after the manual bid

/**
 * Result shape for the handleNewBid function.
 */
export interface HandleNewBidResult {
  success: boolean;
  bidAmount: number;
  isProxyBid: boolean;
  nextBidAmount: number | null;
  proxyBidActive: boolean;
  confirmedMaxBid?: number;
}

/**
 * Handler for getting the current user's proxy bid.
 * @param ctx - The query context.
 * @param args - The arguments for the query.
 * @param args.lotId - The ID of the lot.
 * @returns The proxy bid document if found, otherwise null.
 */
export const getMyProxyBidHandler = async (
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
): Promise<Doc<"proxy_bids"> | null> => {
  const authUser = await getAuthUser(ctx);
  if (!authUser) return null;
  const userId = authUser.userId ?? authUser._id;

  return await ctx.db
    .query("proxy_bids")
    .withIndex("by_bidder_lot", (q) =>
      q.eq("bidderId", userId).eq("lotId", args.lotId)
    )
    .unique();
};

/**
 * Gets the current proxy bid for the authenticated user on a lot.
 */
export const getMyProxyBid = query({
  args: { lotId: v.id("lots") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("proxy_bids"),
      _creationTime: v.number(),
      lotId: v.id("lots"),
      bidderId: v.string(),
      maxBid: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: getMyProxyBidHandler,
});

/**
 * Calculates the minimum increment for a lot based on its price.
 *
 * @param lot - The lot document
 * @returns The minimum increment amount
 */
export function getMinIncrement(lot: Doc<"lots">): number {
  return (
    lot.minIncrement ||
    (lot.startingPrice < PRICE_THRESHOLD_FOR_INCREMENT
      ? SMALL_INCREMENT_AMOUNT
      : LARGE_INCREMENT_AMOUNT)
  );
}

/**
 * Gets the most recent valid bid for a lot by timestamp.
 * In a valid bidding sequence, the most recent bid is also the highest bid.
 *
 * @param ctx - Query or Mutation context
 * @param lotId - ID of the lot
 * @returns The most recent bid document or null if no bids
 */
export async function getMostRecentBid(
  ctx: QueryCtx | MutationCtx,
  lotId: Id<"lots">
): Promise<Doc<"bids"> | null> {
  return await ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lotId))
    .order("desc")
    .filter((q) => q.neq(q.field("status"), "voided"))
    .first();
}

/**
 * Gets the current highest bid amount for a lot.
 * This is either the amount of the most recent valid bid or the lot's current price.
 *
 * @param ctx - Query or Mutation context
 * @param lotId - ID of the lot
 * @returns The highest bid amount
 */
export async function getCurrentHighestBidAmount(
  ctx: QueryCtx | MutationCtx,
  lotId: Id<"lots">
): Promise<number> {
  const lot = await ctx.db.get("lots", lotId);
  if (!lot) {
    throw new Error(`Lot ${lotId} not found`);
  }

  const mostRecentBid = await getMostRecentBid(ctx, lotId);
  if (mostRecentBid) {
    return mostRecentBid.amount;
  }
  return lot.currentPrice;
}

/**
 * Validates a potential bid against lot rules.
 * @param ctx - The mutation context.
 * @param lot - The lot document.
 * @param bidAmount - The amount of the bid.
 * @param maxBid - Optional maximum bid for proxy bidding.
 */
async function validateBid(
  ctx: MutationCtx,
  lot: Doc<"lots">,
  bidAmount: number,
  maxBid?: number
) {
  const mostRecentBid = await getMostRecentBid(ctx, lot._id);
  const minIncrement = getMinIncrement(lot);

  // 1. Basic Price Validation
  if (!mostRecentBid) {
    if (bidAmount < lot.currentPrice) {
      throw new Error(
        `First bid must be at least R${lot.currentPrice.toString()}`
      );
    }
  } else {
    if (bidAmount < lot.currentPrice + minIncrement) {
      throw new Error(
        `Bid amount must be at least R${(lot.currentPrice + minIncrement).toString()}`
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
 * @param ctx - The mutation context.
 * @param lotId - The ID of the lot.
 * @param bidderId - The ID of the bidder.
 * @param maxBid - The maximum bid amount.
 */
async function upsertProxyBid(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  bidderId: string,
  maxBid: number
) {
  const existingProxy = await ctx.db
    .query("proxy_bids")
    .withIndex("by_bidder_lot", (q) =>
      q.eq("bidderId", bidderId).eq("lotId", lotId)
    )
    .unique();

  if (existingProxy) {
    await ctx.db.patch("proxy_bids", existingProxy._id, {
      maxBid,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("proxy_bids", {
      lotId,
      bidderId,
      maxBid,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Extends the lot's effective end time if within the soft-close threshold.
 * The extension is per-lot (`lots.extendedEndTime`) and may exceed the parent
 * auction's own window — that is the point of the anti-snipe soft close.
 *
 * @param ctx - The mutation context.
 * @param lot - The lot document.
 * @param now - The current timestamp.
 */
async function extendLotIfNeeded(
  ctx: MutationCtx,
  lot: Doc<"lots">,
  now: number
) {
  // A lot without a parent auction is not live, so there is no window to extend.
  if (lot.auctionId === undefined) {
    return;
  }

  const auction = await ctx.db.get("auctions", lot.auctionId);
  if (!auction) {
    console.warn(
      `Lot ${lot._id} references missing auction ${lot.auctionId}`
    );
    return;
  }

  const effectiveLotEndTime = lot.extendedEndTime ?? auction.endTime;
  if (effectiveLotEndTime - now < SOFT_CLOSE_THRESHOLD_MS) {
    await ctx.db.patch("lots", lot._id, {
      extendedEndTime: now + SOFT_CLOSE_THRESHOLD_MS,
      isExtended: true,
    });
  }
}

/**
 * Validates an auto-bid amount to ensure it meets requirements.
 * @param autoBidAmount - The potential auto-bid amount.
 * @param currentBidAmount - The current highest bid amount.
 * @param minIncrement - The minimum required increment.
 * @returns The validated amount or null.
 */
function getValidatedAutoBid(
  autoBidAmount: number,
  currentBidAmount: number,
  minIncrement: number
): number | null {
  // If the computed amount is less than required, we cannot place an auto-bid
  const nextRequiredAmount = currentBidAmount + minIncrement;
  if (autoBidAmount < nextRequiredAmount) {
    return null;
  }
  return autoBidAmount;
}

/**
 * Resolves all active proxy bids for a lot after a new bid is placed.
 * @param ctx - The mutation context.
 * @param lotId - The ID of the lot.
 * @param bidderId - The ID of the bidder.
 * @param bidAmount - The amount of the new bid.
 * @returns Result of the proxy bid resolution or null if no proxies are active.
 */
async function resolveProxyBids(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  bidderId: string,
  bidAmount: number
): Promise<HandleNewBidResult | null> {
  const lot = await ctx.db.get("lots", lotId);
  if (!lot) {
    console.warn(
      `Attempted to resolve proxy bids for non-existent lot ${lotId}`
    );
    return null;
  }
  const minIncrement = getMinIncrement(lot);
  const allProxyBids = await ctx.db
    .query("proxy_bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lotId))
    .collect();

  // Sort by maxBid descending, then by creationTime ascending (earliest bidder wins tie)
  const sortedProxies = allProxyBids.sort((a, b) => {
    if (b.maxBid !== a.maxBid) return b.maxBid - a.maxBid;
    return a._creationTime - b._creationTime;
  });

  if (sortedProxies.length === 0) return null;
  const highestProxy = sortedProxies[0];
  const secondHighestProxy = sortedProxies.length > 1 ? sortedProxies[1] : null;

  // Case A: Someone else has a proxy that outbids the current manual bid
  if (highestProxy.bidderId !== bidderId && highestProxy.maxBid > bidAmount) {
    let targetAmount = bidAmount + minIncrement;
    if (secondHighestProxy) {
      const secondMaxPlusIncrement = secondHighestProxy.maxBid + minIncrement;
      if (secondMaxPlusIncrement > targetAmount) {
        targetAmount = secondMaxPlusIncrement;
      }
    }

    if (highestProxy.maxBid < targetAmount) {
      targetAmount = highestProxy.maxBid;
    }

    const validatedAmount = getValidatedAutoBid(
      targetAmount,
      bidAmount,
      minIncrement
    );

    if (validatedAmount !== null) {
      await ctx.db.insert("bids", {
        lotId,
        bidderId: highestProxy.bidderId,
        amount: validatedAmount,
        timestamp: Date.now() + AUTO_BID_TIMESTAMP_OFFSET,
        status: "valid",
      });

      await ctx.db.patch("lots", lotId, {
        currentPrice: validatedAmount,
        winnerId: highestProxy.bidderId,
      });

      return {
        success: true,
        bidAmount: validatedAmount,
        isProxyBid: true,
        nextBidAmount: null,
        proxyBidActive: false,
      };
    }
  }

  // Case B: The current manual bidder is the highest proxy
  if (
    highestProxy.bidderId === bidderId &&
    secondHighestProxy !== null &&
    secondHighestProxy.maxBid >= bidAmount
  ) {
    const secondMaxPlusIncrement = secondHighestProxy.maxBid + minIncrement;
    let targetAmount = highestProxy.maxBid;
    if (secondMaxPlusIncrement < targetAmount) {
      targetAmount = secondMaxPlusIncrement;
    }
    const validatedAmount = getValidatedAutoBid(
      targetAmount,
      bidAmount,
      minIncrement
    );

    if (validatedAmount !== null && validatedAmount > bidAmount) {
      await ctx.db.insert("bids", {
        lotId,
        bidderId: highestProxy.bidderId,
        amount: validatedAmount,
        timestamp: Date.now() + AUTO_BID_TIMESTAMP_OFFSET,
        status: "valid",
      });

      await ctx.db.patch("lots", lotId, {
        currentPrice: validatedAmount,
        winnerId: highestProxy.bidderId,
      });

      let nextBidAmountResult: number | null = null;
      if (highestProxy.maxBid > validatedAmount) {
        nextBidAmountResult = validatedAmount + minIncrement;
      }

      return {
        success: true,
        bidAmount: validatedAmount,
        isProxyBid: true,
        nextBidAmount: nextBidAmountResult,
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
 * @param lotId - ID of the lot
 * @param bidderId - ID of the bidder (userId)
 * @param bidAmount - Amount of the new bid
 * @param maxBid - Optional max bid for proxy bidding
 * @returns Information about the bid result
 */
export async function handleNewBid(
  ctx: MutationCtx,
  lotId: Id<"lots">,
  bidderId: string,
  bidAmount: number,
  maxBid?: number
): Promise<HandleNewBidResult> {
  const lot = await ctx.db.get("lots", lotId);
  if (!lot) throw new Error("Lot not found");

  // 1. Validation
  await validateBid(ctx, lot, bidAmount, maxBid);
  const minIncrement = getMinIncrement(lot);

  // 2. Proxy Bid Update
  if (maxBid !== undefined) {
    await upsertProxyBid(ctx, lotId, bidderId, maxBid);
  }

  // 3. Manual Bid Placement
  const now = Date.now();
  await ctx.db.insert("bids", {
    lotId,
    bidderId,
    amount: bidAmount,
    timestamp: now,
    status: "valid",
  });

  // 4. Update Lot Price and handle Soft Close
  await ctx.db.patch("lots", lotId, {
    currentPrice: bidAmount,
    winnerId: bidderId,
  });
  await extendLotIfNeeded(ctx, lot, now);

  // 5. Proxy Resolution
  const proxyResult = await resolveProxyBids(ctx, lotId, bidderId, bidAmount);
  if (proxyResult) return proxyResult;

  let finalNextBid: number | null = null;
  if (maxBid !== undefined && maxBid > bidAmount) {
    finalNextBid = bidAmount + minIncrement;
  }

  return {
    success: true,
    bidAmount: bidAmount,
    isProxyBid: false,
    nextBidAmount: finalNextBid,
    proxyBidActive: maxBid !== undefined && maxBid > bidAmount,
    confirmedMaxBid: maxBid,
  };
}

/**
 * Gets the current proxy bid for a user on a lot.
 * @param ctx - The query context.
 * @param lotId - The ID of the lot.
 * @param userId - The ID of the user.
 * @returns The user's proxy bid if found.
 */
export async function getProxyBid(
  ctx: QueryCtx,
  lotId: Id<"lots">,
  userId: string
): Promise<Doc<"proxy_bids"> | null> {
  return await ctx.db
    .query("proxy_bids")
    .withIndex("by_bidder_lot", (q) =>
      q.eq("bidderId", userId).eq("lotId", lotId)
    )
    .unique();
}
