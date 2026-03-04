import { v, ConvexError } from "convex/values";

import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { updateCounter } from "./admin_utils";

export const createTicket = mutation({
  args: {
    subject: v.string(),
    message: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    auctionId: v.optional(v.id("auctions")),
  },
  returns: v.id("supportTickets"),
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new ConvexError("Not authenticated");
    const userId = authUser.userId ?? authUser._id;

    const subject = args.subject.trim();
    const message = args.message.trim();

    if (subject.length === 0 || subject.length > 100) {
      throw new ConvexError("Subject must be between 1 and 100 characters");
    }
    if (message.length === 0 || message.length > 2000) {
      throw new ConvexError("Message must be between 1 and 2000 characters");
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

    await updateCounter(ctx, "support", "open", 1);
    await updateCounter(ctx, "support", "total", 1);

    return ticketId;
  },
});

export const getMyTickets = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("supportTickets"),
      _creationTime: v.number(),
      userId: v.string(),
      auctionId: v.optional(v.id("auctions")),
      subject: v.string(),
      message: v.string(),
      status: v.union(
        v.literal("open"),
        v.literal("resolved"),
        v.literal("closed")
      ),
      priority: v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high")
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
      resolvedBy: v.optional(v.string()),
    })
  ),
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
