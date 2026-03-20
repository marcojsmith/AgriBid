import { v, ConvexError } from "convex/values";
import { paginationOptsValidator, type PaginationOptions } from "convex/server";

import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAuth, resolveUserId, getAuthUser } from "./lib/auth";
import { updateCounter, countQuery } from "./admin_utils";
import {
  SUPPORT_TICKET_MAX_SUBJECT_LENGTH,
  SUPPORT_TICKET_MAX_MESSAGE_LENGTH,
} from "./constants";
import type { Id } from "./_generated/dataModel";

/**
 * Handler for creating a support ticket.
 * @param ctx - The mutation context
 * @param args - The arguments for creating a ticket
 * @param args.subject - The subject of the ticket
 * @param args.message - The message content
 * @param args.priority - The priority level (low, medium, high)
 * @param args.auctionId - Optional auction ID associated with the ticket
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

  if (
    subject.length === 0 ||
    subject.length > SUPPORT_TICKET_MAX_SUBJECT_LENGTH
  ) {
    throw new ConvexError(
      `Subject must be between 1 and ${SUPPORT_TICKET_MAX_SUBJECT_LENGTH.toString()} characters`
    );
  }
  if (
    message.length === 0 ||
    message.length > SUPPORT_TICKET_MAX_MESSAGE_LENGTH
  ) {
    throw new ConvexError(
      `Message must be between 1 and ${SUPPORT_TICKET_MAX_MESSAGE_LENGTH.toString()} characters`
    );
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
 * @param ctx - The query context.
 * @param args - The arguments for the query.
 * @param args.paginationOpts - Pagination options.
 * @returns Promise<PaginatedTickets>
 */
export const getMyTicketsHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions }
) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser)
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        totalCount: 0,
        pageStatus: null,
        splitCursor: null,
      };
    const userId = resolveUserId(authUser);
    if (!userId)
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        totalCount: 0,
        pageStatus: null,
        splitCursor: null,
      };

    const ticketsQuery = ctx.db
      .query("supportTickets")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
      .order("desc");

    const [results, totalCount] = await Promise.all([
      ticketsQuery.paginate(args.paginationOpts),
      countQuery(ticketsQuery),
    ]);

    return {
      ...results,
      totalCount,
    };
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
      console.error("getMyTickets query failed:", err);
    }
    return {
      page: [],
      isDone: true,
      continueCursor: "",
      totalCount: 0,
      pageStatus: null,
      splitCursor: null,
    };
  }
};

/**
 * Retrieve a paginated list of support tickets for the authenticated user.
 */
export const getMyTickets = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
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
  handler: getMyTicketsHandler,
});
