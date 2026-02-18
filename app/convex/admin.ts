import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getCallerRole } from "./users";

// --- Internal Helper: Audit Logging ---
export const logAdminAction = internalMutation({
  args: {
    adminId: v.string(),
    action: v.string(),
    targetId: v.optional(v.string()),
    targetType: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

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
    // Note: In a real app, we'd use `ctx.runMutation` or similar for the internal log, 
    // but here we can just insert directly since we are in a mutation.
    const adminIdentity = await ctx.auth.getUserIdentity();
    if (adminIdentity) {
      await ctx.db.insert("auditLogs", {
        adminId: adminIdentity.subject,
        action: "VOID_BID",
        targetId: args.bidId,
        targetType: "bid",
        details: `Reason: ${args.reason}. New Price: ${highestBid ? highestBid.amount : 'Reset to Start'}`,
        timestamp: Date.now(),
      });
    }

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
      .filter((q) => q.eq(q.field("kycStatus"), "pending"))
      .collect();

    return await Promise.all(
        profiles.map(async (p) => ({
            ...p,
            kycDocuments: p.kycDocuments ? await Promise.all(p.kycDocuments.map(id => ctx.storage.getUrl(id))) : [],
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
    } else {
      await ctx.db.patch(profile._id, {
        kycStatus: "rejected",
        kycRejectionReason: args.reason,
      });
    }

    const adminIdentity = await ctx.auth.getUserIdentity();
    if (adminIdentity) {
        await ctx.db.insert("auditLogs", {
            adminId: adminIdentity.subject,
            action: `KYC_${args.decision.toUpperCase()}`,
            targetId: args.userId,
            targetType: "user",
            details: args.reason,
            timestamp: Date.now(),
        });
    }

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

    let tickets;
    if (args.status) {
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

    // Notify user? (Future)
    
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

        await ctx.db.insert("notifications", {
            recipientId: "all",
            type: "info",
            title: args.title,
            message: args.message,
            isRead: false,
            createdAt: Date.now(),
        });
        
        return { success: true };
    }
});
