import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCallerRole } from "./users";
import type { Id } from "./_generated/dataModel";
import { logAudit } from "./admin_utils";
import { COMMISSION_RATE } from "./config";
import { authComponent } from "./auth";

// --- Bid Moderation ---

export const getRecentBids = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const limit = Math.max(1, Math.min(args.limit || 50, 100));

    const bids = await ctx.db
      .query("bids")
      .order("desc")
      .take(limit);

    return await Promise.all(
      bids.map(async (bid) => {
        const auction = await ctx.db.get(bid.auctionId);
        return {
          ...bid,
          auctionTitle: auction?.title || "Unknown Auction",
        };
      }),
    );
  },
});

export const voidBid = mutation({
  args: { bidId: v.id("bids"), reason: v.string() },
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
      .order("desc")
      .first();

    const newPrice = latestValidBid ? latestValidBid.amount : auction.startingPrice;

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

// --- KYC / Verification ---

export const getPendingKYC = query({
  args: {},
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_kycStatus", (q) => q.eq("kycStatus", "pending"))
      .collect();

    return await Promise.all(
      profiles.map(async (p) => {
        const missingIds: string[] = [];
        const urls = p.kycDocuments
          ? await Promise.all(
              p.kycDocuments.map(async (id) => {
                const url = await ctx.storage.getUrl(id as Id<"_storage">);
                if (url === null) {
                  missingIds.push(id);
                  console.error(
                    `Missing KYC document ${id} for profile ${p._id}`,
                  );
                }
                return url;
              }),
            )
          : [];

        return {
          ...p,
          kycDocuments: urls.filter((url): url is string => url !== null),
          hasMissingKycDocuments: missingIds.length > 0,
          missingKycDocumentIds: missingIds,
        };
      }),
    );
  },
});

export const reviewKYC = mutation({
  args: {
    userId: v.string(),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) throw new Error("Profile not found");

    if (args.decision === "approve") {
      await ctx.db.patch(profile._id, {
        kycStatus: "verified",
        isVerified: true,
      });
      // Send Success Notification
      await ctx.db.insert("notifications", {
        recipientId: args.userId,
        type: "success",
        title: "Verification Approved",
        message:
          "Your seller verification is complete. You can now list equipment.",
        link: "/sell",
        isRead: false,
        createdAt: Date.now(),
      });
    } else {
      const reason = args.reason?.trim();
      if (!reason) {
        throw new Error("Rejection reason is required");
      }

      await ctx.db.patch(profile._id, {
        kycStatus: "rejected",
        kycRejectionReason: reason,
      });
      // Send Rejection Notification
      await ctx.db.insert("notifications", {
        recipientId: args.userId,
        type: "error",
        title: "Verification Rejected",
        message: reason,
        link: "/kyc",
        isRead: false,
        createdAt: Date.now(),
      });
    }

    await logAudit(ctx, {
      action: `KYC_${args.decision.toUpperCase()}`,
      targetId: args.userId,
      targetType: "user",
      details: args.reason,
    });

    return { success: true };
  },
});

// --- Finance / Commission ---

export const getFinancialStats = query({
  args: {},
  handler: async (ctx) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    // In a real app, use aggregations. Here we scan.
    const soldAuctions = await ctx.db
      .query("auctions")
      .withIndex("by_status", (q) => q.eq("status", "sold"))
      .collect();

    const totalSalesVolume = soldAuctions.reduce(
      (sum, a) => sum + a.currentPrice,
      0,
    );
    const estimatedCommission = totalSalesVolume * COMMISSION_RATE;

    // Recent Transactions
    const recentSales = soldAuctions
      .sort((a, b) => b.endTime - a.endTime)
      .slice(0, 10)
      .map((a) => ({
        id: a._id,
        title: a.title,
        amount: a.currentPrice,
        estimatedCommission: a.currentPrice * COMMISSION_RATE,
        date: a.endTime,
      }));

    return {
      totalSalesVolume,
      estimatedCommission,
      commissionRate: COMMISSION_RATE,
      recentSales,
      auctionCount: soldAuctions.length,
    };
  },
});

// --- Support / Disputes ---

export const getTickets = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
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

export const resolveTicket = mutation({
  args: { ticketId: v.id("supportTickets"), resolution: v.string() },
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Admin identity not found or invalid");
    }

    await ctx.db.patch(args.ticketId, {
      status: "resolved",
      updatedAt: Date.now(),
      resolvedBy: authUser.userId ?? authUser._id,
    });

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

export const getAuditLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const limit = Math.min(args.limit || 50, MAX_AUDIT_LOG_LIMIT);

    return await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

// --- Communication ---

export const createAnnouncement = mutation({
  args: { title: v.string(), message: v.string() },
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

    await logAudit(ctx, {
      action: "CREATE_ANNOUNCEMENT",
      targetId: "all",
      targetType: "announcement",
      details: title,
    });

    return { success: true };
  },
});
