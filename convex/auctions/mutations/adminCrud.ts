import { v, ConvexError, type Infer } from "convex/values";

import { mutation } from "../../_generated/server";
import { requireAdmin, resolveUserId } from "../../lib/auth";
import { settleLot } from "../internal";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

/**
 * Validator for the fields accepted by {@link createAuction}.
 *
 * Shared between the mutation definition and {@link createAuctionHandler}'s
 * argument type (via `Infer`) so Convex can infer the generated
 * `FunctionReference`'s args correctly.
 */
const createAuctionArgs = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  bannerImage: v.optional(v.id("_storage")),
  startTime: v.number(),
  endTime: v.number(),
  defaultBuyerPremiumPct: v.optional(v.number()),
  defaultSellerCommissionPct: v.optional(v.number()),
});

/**
 * Arguments accepted by {@link createAuctionHandler}.
 */
export interface CreateAuctionArgs {
  title: string;
  description?: string;
  bannerImage?: Id<"_storage">;
  startTime: number;
  endTime: number;
  defaultBuyerPremiumPct?: number;
  defaultSellerCommissionPct?: number;
}

/**
 * Returns the earliest valid (non-voided) bid with the highest amount for a lot,
 * or undefined when the lot has no accepted bids.
 * @param ctx - Mutation context.
 * @param lotId - The lot to inspect.
 * @returns The winning bid document, if any.
 */
async function getAcceptedBid(
  ctx: MutationCtx,
  lotId: Id<"lots">
): Promise<Doc<"bids"> | undefined> {
  const bids = await ctx.db
    .query("bids")
    .withIndex("by_lot", (q) => q.eq("lotId", lotId))
    .collect();

  const validBids = bids.filter((bid) => bid.status !== "voided");
  if (validBids.length === 0) return undefined;

  return validBids.reduce((prev, current) => {
    if (current.amount > prev.amount) return current;
    if (current.amount === prev.amount) {
      return current.timestamp < prev.timestamp ? current : prev;
    }
    return prev;
  });
}

/**
 * Admin creates a new auction (container) in `draft` status.
 *
 * @param ctx - Mutation context.
 * @param args - Auction container fields.
 * @returns The id of the newly created auction.
 */
export const createAuctionHandler = async (
  ctx: MutationCtx,
  args: Infer<typeof createAuctionArgs>
): Promise<Id<"auctions">> => {
  const authUser = await requireAdmin(ctx);
  const userId = resolveUserId(authUser) ?? authUser._id;

  if (args.endTime <= args.startTime) {
    throw new ConvexError("Auction endTime must be after startTime");
  }

  const now = Date.now();

  return await ctx.db.insert("auctions", {
    title: args.title,
    description: args.description,
    bannerImage: args.bannerImage,
    startTime: args.startTime,
    endTime: args.endTime,
    status: "draft",
    defaultBuyerPremiumPct: args.defaultBuyerPremiumPct,
    defaultSellerCommissionPct: args.defaultSellerCommissionPct,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });
};

/**
 * Create an auction (container) (admin only).
 */
export const createAuction = mutation({
  args: createAuctionArgs,
  returns: v.id("auctions"),
  handler: createAuctionHandler,
});

/**
 * Admin edits an auction (container). While the auction has `assigned` lots
 * with accepted bids, the window may not be moved to invalidate those bids:
 * `startTime` cannot move later than an accepted bid's timestamp, and `endTime`
 * cannot shorten below an assigned lot's `extendedEndTime`.
 *
 * @param ctx - Mutation context.
 * @param args - The auction id plus any fields to patch.
 * @returns `{ success: true }` once patched.
 */
export const updateAuctionHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> } & Partial<CreateAuctionArgs>
): Promise<{ success: boolean }> => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get("auctions", args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  const nextStartTime = args.startTime ?? auction.startTime;
  const nextEndTime = args.endTime ?? auction.endTime;
  if (nextEndTime <= nextStartTime) {
    throw new ConvexError("Auction endTime must be after startTime");
  }

  const assignedLots = (
    await ctx.db
      .query("lots")
      .withIndex("by_auctionId", (q) => q.eq("auctionId", args.auctionId))
      .collect()
  ).filter((lot) => lot.status === "assigned");

  if (args.startTime !== undefined) {
    for (const lot of assignedLots) {
      const acceptedBid = await getAcceptedBid(ctx, lot._id);
      if (acceptedBid && args.startTime > acceptedBid.timestamp) {
        throw new ConvexError(
          "Auction startTime cannot move later than an accepted bid on an assigned lot"
        );
      }
    }
  }

  if (args.endTime !== undefined) {
    for (const lot of assignedLots) {
      if (
        lot.extendedEndTime !== undefined &&
        args.endTime < lot.extendedEndTime
      ) {
        throw new ConvexError(
          "Auction endTime cannot shorten below an assigned lot's extended end time"
        );
      }
    }
  }

  await ctx.db.patch("auctions", args.auctionId, {
    ...(args.title !== undefined && { title: args.title }),
    ...(args.description !== undefined && { description: args.description }),
    ...(args.bannerImage !== undefined && { bannerImage: args.bannerImage }),
    ...(args.startTime !== undefined && { startTime: args.startTime }),
    ...(args.endTime !== undefined && { endTime: args.endTime }),
    ...(args.defaultBuyerPremiumPct !== undefined && {
      defaultBuyerPremiumPct: args.defaultBuyerPremiumPct,
    }),
    ...(args.defaultSellerCommissionPct !== undefined && {
      defaultSellerCommissionPct: args.defaultSellerCommissionPct,
    }),
    updatedAt: Date.now(),
  });

  return { success: true };
};

/**
 * Update an auction (container) (admin only).
 */
export const updateAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    bannerImage: v.optional(v.id("_storage")),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    defaultBuyerPremiumPct: v.optional(v.number()),
    defaultSellerCommissionPct: v.optional(v.number()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: updateAuctionHandler,
});

/**
 * Admin publishes an auction container.
 * Transitions `draft -> published`. Lot-level validation (images, reserve
 * price) is enforced elsewhere; only the container window and title matter.
 *
 * @param ctx - Mutation context.
 * @param args - Arguments including the auction id.
 * @param args.auctionId - The auction being published.
 * @returns `{ success: true }` once published.
 */
export const publishAuctionContainerHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
): Promise<{ success: boolean }> => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get("auctions", args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  if (auction.status !== "draft") {
    throw new ConvexError("Only draft auctions can be published");
  }

  if (!auction.title || auction.title.trim().length === 0) {
    throw new ConvexError("Title is required before publishing");
  }

  if (auction.startTime >= auction.endTime) {
    throw new ConvexError("Auction startTime must be before endTime");
  }

  await ctx.db.patch("auctions", args.auctionId, {
    status: "published",
    updatedAt: Date.now(),
  });

  return { success: true };
};

/**
 * Publish an auction (container) (admin only).
 */
export const publishAuctionContainer = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: publishAuctionContainerHandler,
});

/**
 * Admin closes a published auction container.
 * Transitions `published -> closed`. Any lots still `assigned` in the container
 * are settled first (reserve met -> `sold`, otherwise `unsold` and returned to
 * the reassignment pool) so closing can never strand lots in `assigned`.
 *
 * @param ctx - Mutation context.
 * @param args - Arguments including the auction id.
 * @param args.auctionId - The auction being closed.
 * @returns `{ success: true }` once closed.
 */
export const closeAuctionContainerHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
): Promise<{ success: boolean }> => {
  await requireAdmin(ctx);

  const auction = await ctx.db.get("auctions", args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  if (auction.status !== "published") {
    throw new ConvexError("Only published auctions can be closed");
  }

  const now = Date.now();
  const assignedLots = await ctx.db
    .query("lots")
    .withIndex("by_status_auctionId", (q) =>
      q.eq("status", "assigned").eq("auctionId", args.auctionId)
    )
    .collect();

  for (const lot of assignedLots) {
    await settleLot(ctx, lot, now);
  }

  await ctx.db.patch("auctions", args.auctionId, {
    status: "closed",
    updatedAt: now,
  });

  return { success: true };
};

/**
 * Close an auction (container) (admin only).
 */
export const closeAuctionContainer = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: closeAuctionContainerHandler,
});
