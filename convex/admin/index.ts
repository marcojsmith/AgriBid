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
import { paginationOptsValidator } from "convex/server";

import { mutation, query } from "../_generated/server";
import { requireAdmin, getAuthUser, UnauthorizedError } from "../lib/auth";
import { logAudit, updateCounter, countQuery } from "../admin_utils";
import type { Doc, Id } from "../_generated/dataModel";

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
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("bids"),
        _creationTime: v.number(),
        auctionId: v.id("auctions"),
        bidderId: v.string(),
        amount: v.number(),
        timestamp: v.number(),
        status: v.optional(v.union(v.literal("valid"), v.literal("voided"))),
        auctionTitle: v.optional(v.string()),
        auctionLookupStatus: v.union(
          v.literal("FOUND"),
          v.literal("NOT_FOUND"),
          v.literal("ERROR")
        ),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRequired"),
        v.literal("SplitRecommended"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    try {
      await requireAdmin(ctx);

      const [bidsResult, totalCount] = await Promise.all([
        ctx.db
          .query("bids")
          .withIndex("by_timestamp")
          .order("desc")
          .paginate(args.paginationOpts),
        countQuery(ctx.db.query("bids")),
      ]);

      if (bidsResult.page.length === 0) {
        return {
          ...bidsResult,
          page: [],
          totalCount,
        };
      }

      // Collect unique auction IDs
      const uniqueAuctionIds = [
        ...new Set(bidsResult.page.map((b) => b.auctionId)),
      ];

      // Fetch all unique auctions in parallel
      const auctionMap = new Map<
        Id<"auctions">,
        Doc<"auctions"> | null | { _error: true }
      >();
      const failedAuctionIds: Id<"auctions">[] = [];
      await Promise.all(
        uniqueAuctionIds.map(async (id) => {
          try {
            const auction = await ctx.db.get(id);
            auctionMap.set(id, auction);
          } catch {
            failedAuctionIds.push(id);
            auctionMap.set(id, { _error: true });
          }
        })
      );

      if (failedAuctionIds.length > 0) {
        console.error(
          `Admin Monitor: Failed to fetch auction context for ${String(failedAuctionIds.length)} IDs:`,
          failedAuctionIds.slice(0, 5)
        );
      }

      const page = bidsResult.page.map((bid) => {
        const auction = auctionMap.get(bid.auctionId);
        let auctionTitle: string | undefined;
        let auctionLookupStatus: "FOUND" | "NOT_FOUND" | "ERROR" = "NOT_FOUND";

        if (auction) {
          if ("_error" in auction) {
            auctionLookupStatus = "ERROR";
          } else {
            auctionTitle = auction.title;
            auctionLookupStatus = "FOUND";
          }
        }
        return {
          ...bid,
          auctionTitle,
          auctionLookupStatus,
        };
      });

      return {
        ...bidsResult,
        page,
        totalCount,
      };
    } catch (err) {
      if (
        err instanceof UnauthorizedError ||
        (err instanceof Error &&
          (err.name === "UnauthorizedError" ||
            /unauthorized|not authorized|authenticated|not authenticated|unauthenticated/i.test(
              err.message
            )))
      ) {
        throw err;
      }
      console.error("Critical error in getRecentBids:", err);
      throw err;
    }
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
    await requireAdmin(ctx);

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
    const newWinnerId = latestValidBid ? latestValidBid.bidderId : null;

    const patchData: { currentPrice: number; winnerId?: string | null } = {
      currentPrice: newPrice,
    };
    if (auction.winnerId !== newWinnerId) {
      patchData.winnerId = newWinnerId;
    }

    await ctx.db.patch(bid.auctionId, patchData);

    // Log Action
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
 * Query support tickets by status.
 *
 * Returns paginated support tickets with filtering by status (open, resolved, closed).
 * Only accessible to admin users.
 */
export const getTickets = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(
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
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRequired"),
        v.literal("SplitRecommended"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const allowedStatuses = ["open", "resolved", "closed"] as const;
    type TicketStatus = (typeof allowedStatuses)[number];

    if (args.status) {
      if (!allowedStatuses.includes(args.status as TicketStatus)) {
        throw new Error(`Invalid status: ${args.status}`);
      }
      const status = args.status as TicketStatus;
      const [results, totalCount] = await Promise.all([
        ctx.db
          .query("supportTickets")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .paginate(args.paginationOpts),
        countQuery(
          ctx.db
            .query("supportTickets")
            .withIndex("by_status", (q) => q.eq("status", status))
        ),
      ]);
      return {
        ...results,
        totalCount,
      };
    } else {
      const [results, totalCount] = await Promise.all([
        ctx.db
          .query("supportTickets")
          .order("desc")
          .paginate(args.paginationOpts),
        countQuery(ctx.db.query("supportTickets")),
      ]);
      return {
        ...results,
        totalCount,
      };
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

/**
 * Query audit logs of admin actions.
 *
 * Returns a paginated set of recent audit logs for admin review with total count.
 * Only accessible to admin users.
 */
export const getAuditLogs = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
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
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRequired"),
        v.literal("SplitRecommended"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const [logsResult, totalCount] = await Promise.all([
      ctx.db
        .query("auditLogs")
        .withIndex("by_timestamp")
        .order("desc")
        .paginate(args.paginationOpts),
      countQuery(ctx.db.query("auditLogs")),
    ]);

    return {
      page: logsResult.page,
      isDone: logsResult.isDone,
      continueCursor: logsResult.continueCursor,
      totalCount,
      pageStatus: logsResult.pageStatus,
      splitCursor: logsResult.splitCursor,
    };
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

/**
 * List all announcements with read counts.
 *
 * Returns paginated announcements with metadata about how many users have read them.
 * Only accessible to admin users.
 */
export const listAnnouncements = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
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
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRequired"),
        v.literal("SplitRecommended"),
        v.null()
      )
    ),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const [announcementsResult, totalCount] = await Promise.all([
      ctx.db
        .query("notifications")
        .withIndex("by_recipient")
        .filter((q) => q.eq(q.field("recipientId"), "all"))
        .order("desc")
        .paginate(args.paginationOpts),
      countQuery(
        ctx.db
          .query("notifications")
          .withIndex("by_recipient")
          .filter((q) => q.eq(q.field("recipientId"), "all"))
      ),
    ]);

    if (announcementsResult.page.length === 0) {
      return {
        ...announcementsResult,
        page: [],
        totalCount,
      };
    }

    // Parallel fetch read counts using indexed queries
    const announcementIds = announcementsResult.page.map((a) => a._id);
    const readCountsList = await Promise.all(
      announcementIds.map((id) =>
        countQuery(
          ctx.db
            .query("readReceipts")
            .withIndex("by_notification", (q) => q.eq("notificationId", id))
        )
      )
    );

    const readCounts = new Map(
      announcementIds.map((id, index) => [id, readCountsList[index]])
    );

    const page = announcementsResult.page.map((announcement) => ({
      ...announcement,
       
      readCount: readCounts.get(announcement._id) ?? 0,
    }));

    return {
      ...announcementsResult,
      page,
      totalCount,
    };
  },
});

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

    // We use the default ordering which is by _creationTime
    const results = await auctionsQuery.paginate({
      numItems: batchSize,
      cursor: args.cursor ?? null,
    });

    let updatedCount = 0;

    for (const auction of results.page) {
      const highestBid = await ctx.db
        .query("bids")
        .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
        .filter((q) => q.neq(q.field("status"), "voided"))
        .order("desc")
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
