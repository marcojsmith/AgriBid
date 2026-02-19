import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

export const createTicket = mutation({
  args: {
    subject: v.string(),
    message: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    auctionId: v.optional(v.id("auctions")),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const userId = authUser.userId ?? authUser._id;

    const subject = args.subject.trim();
    const message = args.message.trim();

    if (subject.length === 0 || subject.length > 200) {
      throw new Error("Subject must be between 1 and 200 characters");
    }
    if (message.length === 0 || message.length > 2000) {
      throw new Error("Message must be between 1 and 2000 characters");
    }

    const ticketId = await ctx.db.insert("supportTickets", {
      userId,
      subject,
      message,
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
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return [];
      const userId = authUser.userId ?? authUser._id;

      const limit = Math.max(1, Math.min(args.limit || 50, 100));

      return await ctx.db
        .query("supportTickets")
        .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
        .order("desc")
        .take(limit);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getMyTickets query failed:", err);
      }
      return [];
    }
  },
});
