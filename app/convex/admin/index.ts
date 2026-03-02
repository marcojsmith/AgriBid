/**
 * Admin panel operations - core functionality.
 *
 * This module contains the main admin operations including bid management,
 * support ticket handling, audit logging, and announcements.
 *
 * Specialized operations are organized in sub-modules:
 * - kyc.ts: KYC verification and review
 * - statistics.ts: Dashboard metrics and reporting
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCallerRole } from "../users";
import { logAudit, updateCounter } from "../admin_utils";
import { getAuthUser } from "../lib/auth";

// --- Re-export specialized modules for backward compatibility ---
export { getPendingKYC, reviewKYC } from "./kyc";
export {
  getFinancialStats,
  getAdminStats,
  getAnnouncementStats,
  getSupportStats,
  initializeCounters,
} from "./statistics";
export { getSystemConfig, updateSystemConfig } from "./settings";

// --- Bid Moderation ---

/**
 * Query recent bids across all auctions.
 *
 * Returns a paginated list with auction titles for context.
 * Only accessible to admin users.
 */
export const getRecentBids = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("bids"),
      _creationTime: v.number(),
      auctionId: v.id("auctions"),
      bidderId: v.string(),
      amount: v.number(),
      timestamp: v.number(),
      status: v.optional(v.union(v.literal("valid"), v.literal("voided"))),
      auctionTitle: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(args.limit || 50, 100));

    const bids = await ctx.db
      .query("bids")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);

    return await Promise.all(
      bids.map(async (bid) => {
        const auction = await ctx.db.get(bid.auctionId);
        return {
          ...bid,
          auctionTitle: auction?.title || "Unknown Auction",
        };
      })
    );
  },
});

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
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const bid = await ctx.db.get(args.bidId);
    if (!bid) throw new Error("Bid not found");
    if (bid.status === "voided") return { success: true }; // Already voided

    // Mark as void
    await ctx.db.patch(args.bidId, { status: "voided" });

    // Recalculate Auction Price (Next highest valid bid)
    const auction = await ctx.db.get(bid.auctionId);
    if (!auction) throw new Error("Auction not found");

    const latestValidBid = await ctx.db
      .query("bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", bid.auctionId))
      .filter((q) => q.neq(q.field("status"), "voided"))
      .filter((q) => q.neq(q.field("_id"), bid._id))
      .order("desc")
      .first();

    const newPrice = latestValidBid
      ? latestValidBid.amount
      : auction.startingPrice;

    await ctx.db.patch(bid.auctionId, { currentPrice: newPrice });

    // Log Action
    await logAudit(ctx, {
      action: "VOID_BID",
      targetId: args.bidId,
      targetType: "bid",
      details: `Reason: ${args.reason}. New Price: ${newPrice}`,
    });

    return { success: true };
  },
});

// --- Support / Disputes ---

/**
 * Query support tickets by status.
 *
 * Returns support tickets with filtering by status (open, resolved, closed).
 * Only accessible to admin users.
 */
export const getTickets = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("supportTickets"),
      _creationTime: v.number(),
      userId: v.string(),
      auctionId: v.optional(v.id("auctions")),
      subject: v.string(),
      message: v.string(),
      status: v.string(),
      priority: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      resolvedBy: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(args.limit || 50, 100));

    const allowedStatuses = ["open", "resolved", "closed"] as const;
    type TicketStatus = (typeof allowedStatuses)[number];

    if (args.status) {
      if (!allowedStatuses.includes(args.status as TicketStatus)) {
        throw new Error(`Invalid status: ${args.status}`);
      }
      const status = args.status as TicketStatus;
      return await ctx.db
        .query("supportTickets")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(limit);
    } else {
      return await ctx.db.query("supportTickets").take(limit);
    }
  },
});

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
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

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

// --- Audit Logs ---

const MAX_AUDIT_LOG_LIMIT = 100;

/**
 * Query audit logs of admin actions.
 *
 * Returns a limited set of recent audit logs for admin review.
 * Only accessible to admin users.
 */
export const getAuditLogs = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      adminId: v.string(),
      action: v.string(),
      targetId: v.optional(v.string()),
      targetType: v.optional(v.string()),
      details: v.optional(v.string()),
      targetCount: v.optional(v.number()),
      timestamp: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(args.limit ?? 50, MAX_AUDIT_LOG_LIMIT));

    return await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
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
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

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

/**
 * List all announcements with read counts.
 *
 * Returns recent announcements with metadata about how many users have read them.
 * Only accessible to admin users.
 */
export const listAnnouncements = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      _creationTime: v.number(),
      recipientId: v.string(),
      type: v.string(),
      title: v.string(),
      message: v.string(),
      isRead: v.boolean(),
      createdAt: v.number(),
      link: v.optional(v.string()),
      readCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(args.limit || 50, 100));

    const announcements = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", "all"))
      .order("desc")
      .take(limit);

    if (announcements.length === 0) return [];

    // Parallel fetch read counts using indexed queries; still issues N queries
    const announcementIds = announcements.map((a) => a._id);
    const allReadReceipts = await Promise.all(
      announcementIds.map((id) =>
        ctx.db
          .query("readReceipts")
          .withIndex("by_notification", (q) => q.eq("notificationId", id))
          .collect()
      )
    );

    const readCounts = new Map(
      announcementIds.map((id, index) => [id, allReadReceipts[index].length])
    );

    return announcements.map((announcement) => ({
      ...announcement,
      readCount: readCounts.get(announcement._id) || 0,
    }));
  },
});
