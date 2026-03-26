/**
 * Admin panel query functions.
 *
 * This module consolidates all read-only admin operations:
 * - Bid monitoring: getRecentBids
 * - Support: getTickets
 * - Audit: getAuditLogs
 * - Announcements: listAnnouncements
 *
 * Re-exports from specialized sub-modules:
 * - kyc.ts: getPendingKYC
 * - statistics.ts: getFinancialStats, getAdminStats, getAnnouncementStats, getSupportStats
 * - settings.ts: getSystemConfig, getGitHubToken
 */

import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { countQuery } from "../admin_utils";
import { batchFetchReadCounts } from "../notifications";
import type { Doc, Id } from "../_generated/dataModel";

// --- Re-export specialized query modules ---

export { getPendingKYC } from "./kyc";

export {
  getFinancialStats,
  getAdminStats,
  getAnnouncementStats,
  getSupportStats,
} from "./statistics";

export { getSystemConfig, getGitHubToken } from "./settings";

// --- Bid Monitoring ---

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

    const uniqueAuctionIds = [
      ...new Set(bidsResult.page.map((b) => b.auctionId)),
    ];

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

// --- Audit Logs ---

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

// --- Announcements ---

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

    const announcementIds = announcementsResult.page.map((a) => a._id);
    const readCounts = await batchFetchReadCounts(ctx, announcementIds);

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
