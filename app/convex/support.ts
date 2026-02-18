import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createTicket = mutation({
  args: { 
    subject: v.string(), 
    message: v.string(), 
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    auctionId: v.optional(v.id("auctions"))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const ticketId = await ctx.db.insert("supportTickets", {
      userId,
      subject: args.subject,
      message: args.message,
      priority: args.priority,
      auctionId: args.auctionId,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return ticketId;
  },
});

export const getMyTickets = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    return await ctx.db
      .query("supportTickets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
