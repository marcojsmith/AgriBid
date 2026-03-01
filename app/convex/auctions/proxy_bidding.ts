// app/convex/auctions/proxy_bidding.ts
import { v } from "convex/values";
import { query } from "../_generated/server";
import { authComponent } from "../auth";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

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
 * Offset added to auto-bids to ensure they appear after the manual bid that triggered them.
 */
const AUTO_BID_TIMESTAMP_OFFSET = 1;

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

  const highestBidDoc = await getCurrentHighestBid(ctx, auctionId);
  const minIncrement = getMinIncrement(auction);

  // 1. Basic Validation
  if (!highestBidDoc) {
    // First bid ever: must be at least the currentPrice (starting price)
    if (bidAmount < auction.currentPrice) {
      throw new Error(`First bid must be at least R${auction.currentPrice}`);
    }
  } else {
    // Subsequent bids: must be at least currentPrice + increment
    if (bidAmount < auction.currentPrice + minIncrement) {
      throw new Error(
        `Bid amount must be at least R${auction.currentPrice + minIncrement}`
      );
    }
  }

  // 2. Pre-validation for Proxy Bid
  if (maxBid !== undefined && maxBid < bidAmount) {
    throw new Error(
      "Proxy maximum bid must be at least the current bid amount."
    );
  }

  // 3. Upsert Proxy Bid if provided
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

  // 4. Place the manual bid
  await ctx.db.insert("bids", {
    auctionId,
    bidderId,
    amount: bidAmount,
    timestamp: Date.now(),
    status: "valid",
  });

  // 5. Update Auction Price and handle Soft Close
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

  // 6. Trigger Proxy Bidding Resolution
  // We include the caller's proxy bid in the calculation to ensure they are the winner if they have the highest maxBid.
  const allProxyBids = await ctx.db
    .query("proxy_bids")
    .withIndex("by_auction", (q) => q.eq("auctionId", auctionId))
    .collect();

  // Sort all proxy bids by maxBid descending, then by creation time (first bidder wins tie)
  const sortedProxies = allProxyBids.sort((a, b) => {
    if (b.maxBid !== a.maxBid) return b.maxBid - a.maxBid;
    return a.updatedAt - b.updatedAt;
  });

  if (sortedProxies.length > 0) {
    const highestProxy = sortedProxies[0];
    const secondHighestProxy = sortedProxies[1] || null;

    // The auto-bid should be enough to outbid the second highest proxy or the manual bid
    // We check if the highest proxy is NOT the current manual bidder OR if someone else's proxy can outbid the manual bid

    // Case A: Someone else has a proxy that outbids the current manual bid
    if (highestProxy.bidderId !== bidderId && highestProxy.maxBid > bidAmount) {
      let autoBidAmount = bidAmount + minIncrement;

      // If there's a second highest proxy, we must outbid it too
      if (secondHighestProxy) {
        autoBidAmount = Math.max(
          autoBidAmount,
          secondHighestProxy.maxBid + minIncrement
        );
      }

      // Cap at highest proxy's max bid
      autoBidAmount = Math.min(autoBidAmount, highestProxy.maxBid);

      // Final Check: Ensure the capped amount still meets the required increment
      // If it doesn't, we can only bid the maxBid if it's >= the minimum required,
      // otherwise we skip this auto-bid to avoid invalid increments.
      if (autoBidAmount < bidAmount + minIncrement) {
        if (highestProxy.maxBid >= bidAmount + minIncrement) {
          autoBidAmount = highestProxy.maxBid;
        } else {
          // Skip auto-bid if it cannot meet minimum increment
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
      }

      // Place the auto-bid
      await ctx.db.insert("bids", {
        auctionId,
        bidderId: highestProxy.bidderId,
        amount: autoBidAmount,
        timestamp: Date.now() + AUTO_BID_TIMESTAMP_OFFSET, // Ensure auto-bid is chronologically after the manual bid
        status: "valid",
      });

      await ctx.db.patch(auctionId, {
        currentPrice: autoBidAmount,
      });

      return {
        success: true,
        bidAmount: autoBidAmount,
        isProxyBid: true,
        nextBidAmount: null,
        proxyBidActive: false,
        confirmedMaxBid: undefined,
      };
    }

    // Case B: The current manual bidder is the highest proxy
    if (highestProxy.bidderId === bidderId) {
      // If there was a previous highest proxy from someone else that our new proxy just outbid
      if (secondHighestProxy && secondHighestProxy.maxBid >= bidAmount) {
        let autoBidAmount = Math.min(
          highestProxy.maxBid,
          secondHighestProxy.maxBid + minIncrement
        );

        // Ensure autoBidAmount meets minimum required increment
        if (autoBidAmount < bidAmount + minIncrement) {
          if (highestProxy.maxBid >= bidAmount + minIncrement) {
            autoBidAmount = highestProxy.maxBid;
          } else {
            // Cannot outbid the second highest proxy validly, skip auto-bid
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
        }

        if (autoBidAmount > bidAmount) {
          await ctx.db.insert("bids", {
            auctionId,
            bidderId: highestProxy.bidderId,
            amount: autoBidAmount,
            timestamp: Date.now() + AUTO_BID_TIMESTAMP_OFFSET,
            status: "valid",
          });

          await ctx.db.patch(auctionId, {
            currentPrice: autoBidAmount,
          });

          return {
            success: true,
            bidAmount: autoBidAmount,
            isProxyBid: true,
            nextBidAmount:
              highestProxy.maxBid > autoBidAmount
                ? autoBidAmount + minIncrement
                : null,
            proxyBidActive: highestProxy.maxBid > autoBidAmount,
            confirmedMaxBid: highestProxy.maxBid,
          };
        }
      }
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
