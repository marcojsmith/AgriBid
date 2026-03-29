/**
 * Admin panel mutation functions.
 *
 * This module consolidates all write/admin mutations:
 * - Bid moderation: voidBid
 * - Support: resolveTicket
 * - Announcements: createAnnouncement
 * - Maintenance: syncAuctionWinners
 *
 * Re-exports from specialized sub-modules:
 * - kyc.ts: reviewKYC
 * - statistics.ts: initializeCounters
 * - settings.ts: updateSystemConfig, updateGitHubErrorReportingConfig, updateSeoSettings
 * - faq.ts: createFaqItem, updateFaqItem, deleteFaqItem, reorderFaqItems
 */

import { v } from "convex/values";

import { mutation } from "../_generated/server";
import { requireAdmin, getAuthUser } from "../lib/auth";
import { logAudit, updateCounter } from "../admin_utils";

// --- Re-export specialized mutation modules ---

export { reviewKYC } from "./kyc";

export { initializeCounters } from "./statistics";

export {
  updateSystemConfig,
  updateGitHubErrorReportingConfig,
  updateSeoSettings,
} from "./settings";

export {
  createFaqItem,
  updateFaqItem,
  deleteFaqItem,
  reorderFaqItems,
} from "./faq";

export {
  createPlatformFee,
  updatePlatformFee,
  deletePlatformFee,
  reorderPlatformFees,
} from "./fees";

// --- Bid Moderation ---

/**
 * Mark a bid as voided and recalculate auction pricing.
 *
 * - Marks the bid as voided
 * - Recalculates the auction's current price to the next highest valid bid
 * - Reverts to starting price if no valid bids exist
 * - Logs the action for audit
 *
 * Only accessible to admin users.
 */
export const voidBid = mutation({
  args: { bidId: v.id("bids"), reason: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const bid = await ctx.db.get(args.bidId);
    if (!bid) throw new Error("Bid not found");
    if (bid.status === "voided") return { success: true };

    await ctx.db.patch(args.bidId, { status: "voided" });

    const auction = await ctx.db.get(bid.auctionId);
    if (!auction) throw new Error("Auction not found");

    const latestValidBid = await ctx.db
      .query("bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", bid.auctionId))
      .order("desc")
      .filter((q) => q.neq(q.field("status"), "voided"))
      .filter((q) => q.neq(q.field("_id"), bid._id))
      .first();

    const newPrice = latestValidBid
      ? latestValidBid.amount
      : auction.startingPrice;
    const newWinnerId = latestValidBid ? latestValidBid.bidderId : null;

    const patchData: { currentPrice: number; winnerId?: string | null } = {
      currentPrice: newPrice,
    };
    if (auction.winnerId !== newWinnerId) {
      patchData.winnerId = newWinnerId;
    }

    await ctx.db.patch(bid.auctionId, patchData);

    await logAudit(ctx, {
      action: "VOID_BID",
      targetId: args.bidId,
      targetType: "bid",
      details: `Reason: ${args.reason}. New Price: ${String(newPrice)}${auction.winnerId !== newWinnerId ? `. Winner recalculated to ${String(newWinnerId)}` : ""}`,
    });

    return { success: true };
  },
});

// --- Support / Disputes ---

/**
 * Resolve a support ticket with a resolution comment.
 *
 * Marks the ticket as resolved and records the admin who resolved it.
 * Only accessible to admin users.
 */
export const resolveTicket = mutation({
  args: { ticketId: v.id("supportTickets"), resolution: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Admin identity not found or invalid");
    }

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.status === "resolved") {
      return { success: true };
    }

    await ctx.db.patch(args.ticketId, {
      status: "resolved",
      updatedAt: Date.now(),
      resolvedBy: authUser.userId ?? authUser._id,
    });

    if (ticket.status === "open") {
      await updateCounter(ctx, "support", "open", -1);
      await updateCounter(ctx, "support", "resolved", 1);
    }

    await logAudit(ctx, {
      action: "RESOLVE_TICKET",
      targetId: args.ticketId,
      targetType: "supportTicket",
      details: JSON.stringify({ resolution: args.resolution }),
    });

    return { success: true };
  },
});

// --- Communication / Announcements ---

/**
 * Create a platform-wide announcement.
 *
 * Broadcasts an announcement to all users as a notification.
 * Only accessible to admin users.
 */
export const createAnnouncement = mutation({
  args: { title: v.string(), message: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const title = args.title.trim();
    const message = args.message.trim();

    if (title.length === 0 || title.length > 200) {
      throw new Error("Title must be between 1 and 200 characters");
    }
    if (message.length === 0 || message.length > 2000) {
      throw new Error("Message must be between 1 and 2000 characters");
    }

    await ctx.db.insert("notifications", {
      recipientId: "all",
      type: "info",
      title,
      message,
      isRead: false,
      createdAt: Date.now(),
    });

    await updateCounter(ctx, "announcements", "total", 1);

    await logAudit(ctx, {
      action: "CREATE_ANNOUNCEMENT",
      targetId: "all",
      targetType: "announcement",
      details: title,
    });

    return { success: true };
  },
});

// --- Maintenance ---

/**
 * Maintenance mutation to synchronize winnerId with the highest bidder for all auctions.
 *
 * Processes auctions in batches to avoid runtime/memory limits.
 * Returns a cursor if more auctions need processing.
 *
 * Only accessible to admin users.
 */
export const syncAuctionWinners = mutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const batchSize = Math.max(
      1,
      Math.min(Math.floor(args.batchSize ?? 50) || 50, 100)
    );

    const auctionsQuery = ctx.db.query("auctions");

    const results = await auctionsQuery.paginate({
      numItems: batchSize,
      cursor: args.cursor ?? null,
    });

    let updatedCount = 0;

    for (const auction of results.page) {
      const highestBid = await ctx.db
        .query("bids")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .order("desc")
        .filter((q) => q.neq(q.field("status"), "voided"))
        .first();

      const currentWinnerId = highestBid ? highestBid.bidderId : null;

      if (auction.winnerId !== currentWinnerId) {
        await ctx.db.patch(auction._id, {
          winnerId: currentWinnerId,
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await logAudit(ctx, {
        action: "SYNC_AUCTION_WINNERS_BATCH",
        targetId: "batch",
        targetType: "auction",
        details: `Processed batch of ${String(results.page.length)} auctions, updated ${String(updatedCount)} winners.`,
      });
    }

    return {
      processed: results.page.length,
      updated: updatedCount,
      continueCursor: results.continueCursor,
      isDone: results.isDone,
    };
  },
});
