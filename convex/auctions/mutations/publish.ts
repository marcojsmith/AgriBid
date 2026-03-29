import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import {
  requireAdmin,
  tryRequireAdmin,
  getAuthenticatedUserId,
  getCallerRole,
  getAuthUser,
  resolveUserId,
} from "../../lib/auth";
import { logAudit, updateCounter } from "../../admin_utils";
import {
  validateAuctionBeforePublish,
  adjustStatusCounters,
  assertOwnership,
} from "./helpers";
import {
  AUCTION_DEFAULT_DURATION_DAYS,
  AUCTION_MIN_DURATION_DAYS,
  AUCTION_MAX_DURATION_DAYS,
  AUCTION_FLAG_AUTO_HIDE_THRESHOLD,
  MS_PER_DAY,
} from "../../constants";
import type { Id, Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { calculateAndRecordFees } from "../internal";

/**
 * Result type for closeAuctionEarly mutation.
 */
export interface EarlyClosureResult {
  success: boolean;
  finalStatus: string;
  winnerId?: string;
  winningAmount?: number;
  error?: string;
}

/**
 * Handler for publishing a draft auction.
 * Validates required content before transitioning to review.
 *
 * @param ctx - Mutation context
 * @param args - Arguments including auctionId
 * @param args.auctionId - The ID of the auction to publish
 * @returns Object with success boolean
 */
export const publishAuctionHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  assertOwnership(auction, userId);

  if (auction.status !== "draft") {
    throw new ConvexError("Only draft auctions can be published");
  }

  // Validate required fields before allowing publish
  validateAuctionBeforePublish(auction);

  await ctx.db.patch(args.auctionId, { status: "pending_review" });

  await adjustStatusCounters(ctx, "draft", "pending_review");

  return { success: true };
};

/**
 * Submit a draft auction for admin review.
 * Transitions draft -> pending_review
 */
export const submitForReview = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: publishAuctionHandler,
});

/**
 * Alias for submitForReview.
 */
export const publishAuction = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: publishAuctionHandler,
});

/**
 * Flag an auction for review.
 * Auto-hides auction if it receives enough flags.
 * @param ctx - The mutation context.
 * @param args - The arguments for flagging an auction.
 * @param args.auctionId - The ID of the auction to flag
 * @param args.reason - The reason for flagging
 * @param args.details - Optional additional details
 * @returns Promise<{ success: boolean; hideTriggered: boolean }>
 */
export const flagAuctionHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId: Id<"auctions">;
    reason: "misleading" | "inappropriate" | "suspicious" | "other";
    details?: string;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  if (auction.sellerId === userId) {
    throw new ConvexError("You cannot flag your own auction");
  }

  const existingFlags = await ctx.db
    .query("auctionFlags")
    .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
    .collect();

  const userHasFlagged = existingFlags.some(
    (flag) => flag.reporterId === userId && flag.status === "pending"
  );

  if (userHasFlagged) {
    throw new ConvexError("You have already flagged this auction");
  }

  await ctx.db.insert("auctionFlags", {
    auctionId: args.auctionId,
    reporterId: userId,
    reason: args.reason,
    details: args.details,
    status: "pending",
    createdAt: Date.now(),
  });

  let hideTriggered = false;

  const pendingFlags = existingFlags.filter((f) => f.status === "pending");
  if (pendingFlags.length + 1 >= AUCTION_FLAG_AUTO_HIDE_THRESHOLD) {
    if (auction.status === "active") {
      await ctx.db.patch(args.auctionId, {
        status: "pending_review",
        hiddenByFlags: true,
      });

      await updateCounter(ctx, "auctions", "active", -1);
      await updateCounter(ctx, "auctions", "pending", 1);

      hideTriggered = true;
    }

    await logAudit(ctx, {
      action: "AUTO_HIDE_AUCTION_FLAGS",
      targetId: args.auctionId,
      targetType: "auction",
      details: JSON.stringify({
        flagCount: pendingFlags.length + 1,
        threshold: AUCTION_FLAG_AUTO_HIDE_THRESHOLD,
        hideTriggered,
        reason: args.reason,
      }),
    });
  }

  return { success: true, hideTriggered };
};

export const flagAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
    reason: v.union(
      v.literal("misleading"),
      v.literal("inappropriate"),
      v.literal("suspicious"),
      v.literal("other")
    ),
    details: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), hideTriggered: v.boolean() }),
  handler: flagAuctionHandler,
});

/**
 * Dismiss a flag (admin only).
 * @param ctx - The mutation context.
 * @param args - The arguments for dismissing a flag.
 * @param args.flagId - The ID of the flag to dismiss
 * @param args.dismissalReason - Optional reason for dismissal
 * @returns Promise<{ success: boolean; auctionRestored: boolean }>
 */
export const dismissFlagHandler = async (
  ctx: MutationCtx,
  args: {
    flagId: Id<"auctionFlags">;
    dismissalReason?: string;
  }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new Error("Not authorized: Admin privileges required");
  }

  const flag = await ctx.db.get(args.flagId);
  if (!flag) {
    throw new ConvexError("Flag not found");
  }

  if (flag.status !== "pending") {
    throw new ConvexError("Flag has already been reviewed");
  }

  await ctx.db.patch(args.flagId, {
    status: "dismissed",
  });

  let auctionRestored = false;

  const auction = await ctx.db.get(flag.auctionId);
  if (auction?.status === "pending_review" && auction.hiddenByFlags === true) {
    const remainingFlags = await ctx.db
      .query("auctionFlags")
      .withIndex("by_auction_status", (q) =>
        q.eq("auctionId", flag.auctionId).eq("status", "pending")
      )
      .collect();

    if (remainingFlags.length < AUCTION_FLAG_AUTO_HIDE_THRESHOLD) {
      await ctx.db.patch(flag.auctionId, {
        status: "active",
        hiddenByFlags: false,
      });

      await updateCounter(ctx, "auctions", "pending", -1);
      await updateCounter(ctx, "auctions", "active", 1);

      auctionRestored = true;
    }
  }

  const authUser = await getAuthUser(ctx);
  const adminId = authUser ? resolveUserId(authUser) : "unknown";

  await logAudit(ctx, {
    action: "DISMISS_FLAG",
    targetId: args.flagId,
    targetType: "auctionFlag",
    details: JSON.stringify({
      adminId,
      auctionId: flag.auctionId,
      reason: flag.reason,
      dismissalReason: args.dismissalReason,
      auctionRestored,
    }),
  });

  return { success: true, auctionRestored };
};

export const dismissFlag = mutation({
  args: {
    flagId: v.id("auctionFlags"),
    dismissalReason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), auctionRestored: v.boolean() }),
  handler: dismissFlagHandler,
});

/**
 * Approve an auction for publication.
 * @param ctx - The mutation context.
 * @param args - The arguments for approving an auction.
 * @param args.auctionId - The ID of the auction to approve
 * @param args.durationDays - Optional override for auction duration
 * @returns Promise<{ success: boolean }>
 */
export const approveAuctionHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions">; durationDays?: number }
) => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) throw new ConvexError("Auction not found");
  if (auction.status !== "pending_review") {
    throw new ConvexError("Only auctions in pending_review can be approved");
  }

  const durationDays =
    args.durationDays ?? auction.durationDays ?? AUCTION_DEFAULT_DURATION_DAYS;
  if (
    durationDays < AUCTION_MIN_DURATION_DAYS ||
    durationDays > AUCTION_MAX_DURATION_DAYS
  ) {
    throw new ConvexError(
      `Invalid duration: must be between ${AUCTION_MIN_DURATION_DAYS.toString()} and ${AUCTION_MAX_DURATION_DAYS.toString()} days`
    );
  }

  const startTime = Date.now();
  const durationMs = durationDays * MS_PER_DAY;
  const endTime = startTime + durationMs;

  await ctx.db.patch(args.auctionId, {
    status: "active",
    startTime,
    endTime,
    hiddenByFlags: false,
  });

  await updateCounter(ctx, "auctions", "pending", -1);
  await updateCounter(ctx, "auctions", "active", 1);

  return { success: true };
};

export const approveAuction = mutation({
  args: { auctionId: v.id("auctions"), durationDays: v.optional(v.number()) },
  returns: v.object({ success: v.boolean() }),
  handler: approveAuctionHandler,
});

/**
 * Reject an auction during review.
 * @param ctx - The mutation context.
 * @param args - The arguments for rejecting an auction.
 * @param args.auctionId - The ID of the auction to reject
 * @returns Promise<{ success: boolean }>
 */
export const rejectAuctionHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) throw new ConvexError("Auction not found");
  if (auction.status !== "pending_review") {
    throw new ConvexError("Only auctions in pending_review can be rejected");
  }

  await ctx.db.patch(args.auctionId, {
    status: "rejected",
    startTime: undefined,
    endTime: undefined,
    hiddenByFlags: false,
  });

  await updateCounter(ctx, "auctions", "pending", -1);

  return { success: true };
};

export const rejectAuction = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: rejectAuctionHandler,
});

/**
 * Admin mutation to manually close an active auction early.
 * @param ctx - The mutation context.
 * @param args - The arguments for closing an auction.
 * @param args.auctionId - The ID of the auction to close
 * @returns Promise<EarlyClosureResult>
 */
export const closeAuctionEarlyHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
): Promise<EarlyClosureResult> => {
  const authResult = await tryRequireAdmin(ctx);
  if (!authResult.authorized) {
    return {
      success: false,
      finalStatus: "",
      error: authResult.error,
    };
  }

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    return {
      success: false,
      finalStatus: "",
      error: "Auction not found",
    };
  }

  if (auction.status !== "active") {
    return {
      success: false,
      finalStatus: "",
      error: "Auction has already been settled",
    };
  }

  const bids = await ctx.db
    .query("bids")
    .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
    .collect();

  const validBids = bids.filter((b: Doc<"bids">) => b.status !== "voided");
  const hasBids = validBids.length > 0;

  type AuctionStatus = "sold" | "unsold";
  let finalStatus: AuctionStatus;
  let winnerId: string | undefined;
  let winningAmount: number | undefined;

  let highestBid: Doc<"bids"> | undefined;
  if (hasBids) {
    highestBid = validBids.reduce((prev: Doc<"bids">, current: Doc<"bids">) => {
      if (current.amount > prev.amount) return current;
      if (current.amount === prev.amount) {
        return current.timestamp < prev.timestamp ? current : prev;
      }
      return prev;
    });
  }

  const reserveMet =
    hasBids &&
    highestBid !== undefined &&
    highestBid.amount >= auction.reservePrice;

  if (hasBids && reserveMet && highestBid) {
    finalStatus = "sold";
    winnerId = highestBid.bidderId;
    winningAmount = highestBid.amount;
  } else {
    finalStatus = "unsold";
  }

  await ctx.db.patch(auction._id, {
    status: finalStatus,
    winnerId,
  });

  await updateCounter(ctx, "auctions", "active", -1);

  if (finalStatus === "sold") {
    await updateCounter(ctx, "auctions", "soldCount", 1);
    await updateCounter(ctx, "auctions", "salesVolume", winningAmount ?? 0);
    await calculateAndRecordFees(ctx, auction);
  }

  const authUser = await getAuthUser(ctx);
  const adminId = authUser ? resolveUserId(authUser) : "unknown";

  await logAudit(ctx, {
    action: "auction_early_closure",
    targetId: args.auctionId,
    targetType: "auction",
    details: JSON.stringify({
      adminId,
      title: auction.title,
      finalStatus,
      winnerId,
      winningAmount,
      reserveMet,
      bidCount: validBids.length,
    }),
  });

  return {
    success: true,
    finalStatus,
    winnerId,
    winningAmount,
  };
};

export const closeAuctionEarly = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({
    success: v.boolean(),
    finalStatus: v.string(),
    winnerId: v.optional(v.string()),
    winningAmount: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: closeAuctionEarlyHandler,
});
