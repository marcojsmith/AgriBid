import { v, ConvexError } from "convex/values";

import { mutation } from "../../_generated/server";
import {
  tryRequireAdmin,
  getAuthenticatedUserId,
  getCallerRole,
  getAuthUser,
  resolveUserId,
} from "../../lib/auth";
import { logAudit, updateCounter } from "../../admin_utils";
import { AUCTION_FLAG_AUTO_HIDE_THRESHOLD } from "../../constants";
import type { Id, Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import {
  calculateAndRecordFees,
  logAuctionSettlementActivity,
} from "../internal";

/**
 * Result type for closeLotEarly mutation.
 */
export interface EarlyClosureResult {
  success: boolean;
  finalStatus: string;
  winnerId?: string;
  winningAmount?: number;
  error?: string;
}

/**
 * Flag a lot for review.
 * Auto-hides the lot if it receives enough flags.
 * @param ctx - The mutation context.
 * @param args - The arguments for flagging a lot.
 * @param args.lotId - The ID of the lot to flag
 * @param args.reason - The reason for flagging
 * @param args.details - Optional additional details
 * @returns Promise<{ success: boolean; hideTriggered: boolean }>
 */
export const flagLotHandler = async (
  ctx: MutationCtx,
  args: {
    lotId: Id<"lots">;
    reason: "misleading" | "inappropriate" | "suspicious" | "other";
    details?: string;
  }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    throw new ConvexError("Lot not found");
  }

  if (lot.sellerId === userId) {
    throw new ConvexError("You cannot flag your own lot");
  }

  const existingFlags = await ctx.db
    .query("lotFlags")
    .withIndex("by_lot", (q) => q.eq("lotId", args.lotId))
    .collect();

  const userHasFlagged = existingFlags.some(
    (flag) => flag.reporterId === userId && flag.status === "pending"
  );

  if (userHasFlagged) {
    throw new ConvexError("You have already flagged this lot");
  }

  await ctx.db.insert("lotFlags", {
    lotId: args.lotId,
    reporterId: userId,
    reason: args.reason,
    details: args.details,
    status: "pending",
    createdAt: Date.now(),
  });

  let hideTriggered = false;

  const pendingFlags = existingFlags.filter((f) => f.status === "pending");
  if (pendingFlags.length + 1 >= AUCTION_FLAG_AUTO_HIDE_THRESHOLD) {
    if (lot.status === "approved") {
      await ctx.db.patch("lots", args.lotId, {
        status: "pending_review",
        hiddenByFlags: true,
      });

      await updateCounter(ctx, "lots", "active", -1);
      await updateCounter(ctx, "lots", "pending", 1);

      hideTriggered = true;
    }

    await logAudit(ctx, {
      action: "AUTO_HIDE_AUCTION_FLAGS",
      targetId: args.lotId,
      targetType: "lot",
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

export const flagLot = mutation({
  args: {
    lotId: v.id("lots"),
    reason: v.union(
      v.literal("misleading"),
      v.literal("inappropriate"),
      v.literal("suspicious"),
      v.literal("other")
    ),
    details: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), hideTriggered: v.boolean() }),
  handler: flagLotHandler,
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
    flagId: Id<"lotFlags">;
    dismissalReason?: string;
  }
) => {
  const role = await getCallerRole(ctx);
  if (role !== "admin") {
    throw new Error("Not authorized: Admin privileges required");
  }

  const flag = await ctx.db.get("lotFlags", args.flagId);
  if (!flag) {
    throw new ConvexError("Flag not found");
  }

  if (flag.status !== "pending") {
    throw new ConvexError("Flag has already been reviewed");
  }

  await ctx.db.patch("lotFlags", args.flagId, {
    status: "dismissed",
  });

  let auctionRestored = false;

  const lot = await ctx.db.get("lots", flag.lotId);
  if (lot?.status === "pending_review" && lot.hiddenByFlags === true) {
    const remainingFlags = await ctx.db
      .query("lotFlags")
      .withIndex("by_lot_status", (q) =>
        q.eq("lotId", flag.lotId).eq("status", "pending")
      )
      .collect();

    if (remainingFlags.length < AUCTION_FLAG_AUTO_HIDE_THRESHOLD) {
      await ctx.db.patch("lots", flag.lotId, {
        status: "approved",
        hiddenByFlags: false,
      });

      await updateCounter(ctx, "lots", "pending", -1);
      await updateCounter(ctx, "lots", "active", 1);

      auctionRestored = true;
    }
  }

  const authUser = await getAuthUser(ctx);
  const adminId = authUser ? resolveUserId(authUser) : "unknown";

  await logAudit(ctx, {
    action: "DISMISS_FLAG",
    targetId: args.flagId,
    targetType: "lotFlag",
    details: JSON.stringify({
      adminId,
      lotId: flag.lotId,
      reason: flag.reason,
      dismissalReason: args.dismissalReason,
      auctionRestored,
    }),
  });

  return { success: true, auctionRestored };
};

export const dismissFlag = mutation({
  args: {
    flagId: v.id("lotFlags"),
    dismissalReason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), auctionRestored: v.boolean() }),
  handler: dismissFlagHandler,
});

/**
 * Admin mutation to manually close an assigned lot early.
 * Closing one lot does not settle its parent auction container — other lots
 * in the same auction may still be running.
 * @param ctx - The mutation context.
 * @param args - The arguments for closing a lot.
 * @param args.lotId - The ID of the lot to close
 * @returns Promise<EarlyClosureResult>
 */
export const closeLotEarlyHandler = async (
  ctx: MutationCtx,
  args: { lotId: Id<"lots"> }
): Promise<EarlyClosureResult> => {
  const authResult = await tryRequireAdmin(ctx);
  if (!authResult.authorized) {
    return {
      success: false,
      finalStatus: "",
      error: authResult.error,
    };
  }

  const lot = await ctx.db.get("lots", args.lotId);
  if (!lot) {
    return {
      success: false,
      finalStatus: "",
      error: "Lot not found",
    };
  }

  if (lot.status !== "assigned") {
    return {
      success: false,
      finalStatus: "",
      error: "Lot has already been settled",
    };
  }

  const bids = await ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
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
    highestBid.amount >= lot.reservePrice;

  if (hasBids && reserveMet && highestBid) {
    finalStatus = "sold";
    winnerId = highestBid.bidderId;
    winningAmount = highestBid.amount;
  } else {
    finalStatus = "unsold";
  }

  await ctx.db.patch("lots", lot._id, {
    status: finalStatus,
    winnerId,
    settledAt: Date.now(),
  });

  await updateCounter(ctx, "lots", "active", -1);

  if (finalStatus === "sold") {
    await updateCounter(ctx, "lots", "soldCount", 1);
    await updateCounter(ctx, "lots", "salesVolume", winningAmount ?? 0);
    await calculateAndRecordFees(ctx, lot, winningAmount);
  }

  await logAuctionSettlementActivity(ctx, lot, finalStatus, winnerId);

  const authUser = await getAuthUser(ctx);
  const adminId = authUser ? resolveUserId(authUser) : "unknown";

  await logAudit(ctx, {
    action: "auction_early_closure",
    targetId: args.lotId,
    targetType: "lot",
    details: JSON.stringify({
      adminId,
      title: lot.title,
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

export const closeLotEarly = mutation({
  args: { lotId: v.id("lots") },
  returns: v.object({
    success: v.boolean(),
    finalStatus: v.string(),
    winnerId: v.optional(v.string()),
    winningAmount: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: closeLotEarlyHandler,
});
