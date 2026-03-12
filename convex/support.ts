import { v, ConvexError } from "convex/values";

import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAuth, resolveUserId, getAuthUser } from "./lib/auth";
import { updateCounter } from "./admin_utils";
import type { Id } from "./_generated/dataModel";

/**
 * Handler for creating a support ticket.
 * @param ctx
 * @param args
 * @param args.subject
 * @param args.message
 * @param args.priority
 * @param args.auctionId
 * @returns Promise<Id<"supportTickets">>
 */
export const createTicketHandler = async (
  ctx: MutationCtx,
  args: {
    subject: string;
    message: string;
    priority: "low" | "medium" | "high";
    auctionId?: Id<"auctions">;
  }
) => {
  const authUser = await requireAuth(ctx);
  const userId = resolveUserId(authUser);
  if (!userId) throw new Error("Unable to determine user ID");

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
};

/**
 * Create a new support ticket.
 */
export const createTicket = mutation({
  args: {
    subject: v.string(),
    message: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    auctionId: v.optional(v.id("auctions")),
  },
  returns: v.id("supportTickets"),
  handler: createTicketHandler,
});

/**
 * Handler for getting the current user's support tickets.
 * @param ctx
 * @param args
 * @param args.limit
 * @returns Promise<PaginatedTickets>
 */
export const getMyTicketsHandler = async (
  ctx: QueryCtx,
  args: { limit?: number }
) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return [];
    const userId = resolveUserId(authUser);
    if (!userId) return [];

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
};

/**
 * Retrieve a paginated list of support tickets for the authenticated user.
 */
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
  handler: getMyTicketsHandler,
});
