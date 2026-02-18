import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCallerRole } from "./users";
import type { Id } from "./_generated/dataModel";
import { logAudit } from "./admin_utils";

// --- Bid Moderation ---

export const getRecentBids = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const bids = await ctx.db
      .query("bids")
      .order("desc")
      .take(args.limit || 50);

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

export const voidBid = mutation({
  args: { bidId: v.id("bids"), reason: v.string() },
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const bid = await ctx.db.get(args.bidId);
    if (!bid) throw new Error("Bid not found");

    // Mark as void
    await ctx.db.patch(args.bidId, { status: "voided" });

    // Recalculate Auction Price (Simple approach: find next highest valid bid)
    // In a real high-frequency system, this would be more complex.
    const validBids = await ctx.db
      .query("bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", bid.auctionId))
      .filter((q) => q.neq(q.field("status"), "voided"))
      .collect();

    // Re-sort in memory just to be safe (descending amount)
    validBids.sort((a, b) => b.amount - a.amount);
    
    const highestBid = validBids[0];
    const auction = await ctx.db.get(bid.auctionId);

    if (auction) {
        const newPrice = highestBid ? highestBid.amount : auction.startingPrice;
        await ctx.db.patch(bid.auctionId, { currentPrice: newPrice });
    }

    // Log Action
    await logAudit(ctx, {
      action: "VOID_BID",
      targetId: args.bidId,
      targetType: "bid",
      details: `Reason: ${args.reason}. New Price: ${highestBid ? highestBid.amount : 'Reset to Start'}`,
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
        profiles.map(async (p) => ({
            ...p,
            kycDocuments: p.kycDocuments ? await Promise.all(p.kycDocuments.map(id => ctx.storage.getUrl(id as Id<"_storage">))) : [],
        }))
    );
  },
});

export const reviewKYC = mutation({
  args: { 
    userId: v.string(), 
    decision: v.union(v.literal("approve"), v.literal("reject")), 
    reason: v.optional(v.string()) 
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
        message: "Your seller verification is complete. You can now list equipment.",
        link: "/sell",
        isRead: false,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.patch(profile._id, {
        kycStatus: "rejected",
        kycRejectionReason: args.reason,
      });
      // Send Rejection Notification
      await ctx.db.insert("notifications", {
        recipientId: args.userId,
        type: "error",
        title: "Verification Rejected",
        message: args.reason || "Your KYC application was rejected. Please review and try again.",
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

    const totalSalesVolume = soldAuctions.reduce((sum, a) => sum + a.currentPrice, 0);
    // Assuming flat 5% commission for prototype
    const estimatedCommission = totalSalesVolume * 0.05; 
    
    // Recent Transactions
    const recentSales = soldAuctions
        .sort((a, b) => b.endTime - a.endTime)
        .slice(0, 10)
        .map(a => ({
            id: a._id,
            title: a.title,
            amount: a.currentPrice,
            date: a.endTime
        }));

    return {
      totalSalesVolume,
      estimatedCommission,
      recentSales,
      auctionCount: soldAuctions.length
    };
  },
});

// --- Support / Disputes ---

export const getTickets = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const allowedStatuses = new Set(["open", "resolved", "closed"]);
    let tickets;
    if (args.status) {
        if (!allowedStatuses.has(args.status)) {
            throw new Error(`Invalid status: ${args.status}`);
        }
        tickets = await ctx.db
            .query("supportTickets")
            .withIndex("by_status", q => q.eq("status", args.status as any))
            .collect();
    } else {
        tickets = await ctx.db.query("supportTickets").collect();
    }

    return tickets;
  },
});

export const resolveTicket = mutation({
  args: { ticketId: v.id("supportTickets"), resolution: v.string() },
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") throw new Error("Unauthorized");

    const adminIdentity = await ctx.auth.getUserIdentity();
    
    await ctx.db.patch(args.ticketId, {
        status: "resolved",
        updatedAt: Date.now(),
        resolvedBy: adminIdentity?.subject
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

export const getAuditLogs = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const role = await getCallerRole(ctx);
        if (role !== "admin") throw new Error("Unauthorized");

        return await ctx.db
            .query("auditLogs")
            .withIndex("by_timestamp")
            .order("desc")
            .take(args.limit || 50);
    }
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
    }
});
