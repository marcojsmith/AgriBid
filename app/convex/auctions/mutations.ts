import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { getCallerRole, getAuthUser, resolveUserId } from "../lib/auth";
import { logAudit, updateCounter } from "../admin_utils";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const deleteUpload = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Unauthorized: Only admins can delete storage items");
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      console.warn(
        `Attempted to delete non-existent storage item: ${args.storageId}`
      );
      return;
    }

    await ctx.storage.delete(args.storageId);
  },
});

export const createAuction = mutation({
  args: {
    title: v.string(),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    operatingHours: v.number(),
    location: v.string(),
    description: v.string(),
    startingPrice: v.number(),
    reservePrice: v.number(),
    durationDays: v.number(),
    images: v.object({
      front: v.optional(v.string()),
      engine: v.optional(v.string()),
      cabin: v.optional(v.string()),
      rear: v.optional(v.string()),
      additional: v.optional(v.array(v.string())),
    }),
    conditionChecklist: v.object({
      engine: v.boolean(),
      hydraulics: v.boolean(),
      tires: v.boolean(),
      serviceHistory: v.boolean(),
      notes: v.optional(v.string()),
    }),
    isDraft: v.optional(v.boolean()),
  },
  returns: v.id("auctions"),
  handler: async (ctx, args) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      throw new Error("Not authenticated");
    }
    const userId = resolveUserId(authUser);
    if (!userId) {
      throw new Error("Unable to determine user ID");
    }

    const { durationDays, isDraft, ...restArgs } = args;

    if (durationDays <= 0 || durationDays > 365) {
      throw new ConvexError("Invalid duration: must be between 1 and 365 days");
    }

    if (restArgs.images.additional && restArgs.images.additional.length > 6) {
      throw new ConvexError("Additional images limit exceeded (max 6)");
    }

    const images = {
      ...restArgs.images,
      additional: restArgs.images.additional || [],
    };

    const status = isDraft ? "draft" : "pending_review";

    const auctionId = await ctx.db.insert("auctions", {
      ...restArgs,
      images,
      sellerId: userId,
      status,
      currentPrice: args.startingPrice,
      minIncrement: args.startingPrice < 10000 ? 100 : 500,
      durationDays: durationDays,
    });

    await updateCounter(ctx, "auctions", "total", 1);
    if (isDraft) {
      await updateCounter(ctx, "auctions", "draft", 1);
    } else {
      await updateCounter(ctx, "auctions", "pending", 1);
    }

    return auctionId;
  },
});

export const approveAuction = mutation({
  args: { auctionId: v.id("auctions"), durationDays: v.optional(v.number()) },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized: Admin privileges required");
    }

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new ConvexError("Auction not found");
    if (auction.status !== "pending_review") {
      throw new ConvexError("Only auctions in pending_review can be approved");
    }

    const durationDays = args.durationDays ?? auction.durationDays ?? 7;
    if (durationDays <= 0 || durationDays > 365) {
      throw new ConvexError("Invalid duration: must be between 1 and 365 days");
    }

    const startTime = Date.now();
    const durationMs = durationDays * 24 * 60 * 60 * 1000;
    const endTime = startTime + durationMs;

    await ctx.db.patch(args.auctionId, {
      status: "active",
      startTime,
      endTime,
    });

    await updateCounter(ctx, "auctions", "pending", -1);
    await updateCounter(ctx, "auctions", "active", 1);

    return { success: true };
  },
});

/**
 * Validate that an auction record contains required fields for a target status.
 *
 * Currently enforces that setting the status to `active` requires `auction.endTime`.
 *
 * @param auction - Auction object containing at least `status` and optional `endTime`
 * @param newStatus - Target status to validate against
 * @throws Error if `newStatus` is `active` and `auction.endTime` is missing
 */
function validateAuctionStatus(
  auction: { status: string; endTime?: number | null },
  newStatus: string
): void {
  if (newStatus === "active" && !auction.endTime) {
    throw new Error(
      "Cannot set status to 'active' without endTime. Use approveAuction or provide endTime in the update."
    );
  }
}

export const rejectAuction = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized: Admin privileges required");
    }

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new ConvexError("Auction not found");
    if (auction.status !== "pending_review") {
      throw new ConvexError("Only auctions in pending_review can be rejected");
    }

    await ctx.db.patch(args.auctionId, {
      status: "rejected",
      startTime: undefined,
      endTime: undefined,
    });

    await updateCounter(ctx, "auctions", "pending", -1);

    return { success: true };
  },
});

export const adminUpdateAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
    updates: v.object({
      title: v.optional(v.string()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      operatingHours: v.optional(v.number()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
      startingPrice: v.optional(v.number()),
      reservePrice: v.optional(v.number()),
      status: v.optional(
        v.union(
          v.literal("draft"),
          v.literal("pending_review"),
          v.literal("active"),
          v.literal("sold"),
          v.literal("unsold"),
          v.literal("rejected")
        )
      ),
      startTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      currentPrice: v.optional(v.number()),
    }),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized");
    }

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) throw new Error("Auction not found");

    const oldStatus = auction.status;
    const newStatus = args.updates.status;

    if (newStatus === "active") {
      const patched = { ...auction, ...args.updates };
      validateAuctionStatus(patched, newStatus);
    }

    await ctx.db.patch(args.auctionId, args.updates);

    if (newStatus && oldStatus !== newStatus) {
      await adjustStatusCounters(ctx, oldStatus, newStatus);
    }

    await logAudit(ctx, {
      action: "UPDATE_AUCTION",
      targetId: args.auctionId,
      targetType: "auction",
      details: JSON.stringify(args.updates),
    });

    return { success: true };
  },
});

/**
 * Update global auction counters when an auction changes status.
 *
 * Maps recognised statuses to the per-category counters and decrements the counter for the old status (if mapped) and increments the counter for the new status (if mapped).
 *
 * @param oldStatus - Previous auction status; recognised values include `active` and `pending_review` (only these map to counters)
 * @param newStatus - New auction status; recognised values include `active` and `pending_review` (only these map to counters)
 */
async function adjustStatusCounters(
  ctx: MutationCtx, // Changed from any
  oldStatus: string,
  newStatus: string
) {
  const statusToCounterKey: Record<string, "active" | "pending" | undefined> = {
    active: "active",
    pending_review: "pending",
  };

  const oldKey = statusToCounterKey[oldStatus];
  const newKey = statusToCounterKey[newStatus];

  if (oldKey) await updateCounter(ctx, "auctions", oldKey, -1);
  if (newKey) await updateCounter(ctx, "auctions", newKey, 1);
}

const MAX_BULK_UPDATE_SIZE = 50;

export const bulkUpdateAuctions = mutation({
  args: {
    auctionIds: v.array(v.id("auctions")),
    updates: v.object({
      status: v.optional(
        v.union(
          v.literal("draft"),
          v.literal("pending_review"),
          v.literal("active"),
          v.literal("sold"),
          v.literal("unsold"),
          v.literal("rejected")
        )
      ),
      startTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      startingPrice: v.optional(v.number()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    updated: v.array(v.id("auctions")),
    skipped: v.array(v.id("auctions")),
  }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized");
    }

    if (args.auctionIds.length > MAX_BULK_UPDATE_SIZE) {
      throw new Error(
        `Bulk update exceeds limit of ${MAX_BULK_UPDATE_SIZE} auctions`
      );
    }

    const updated: Id<"auctions">[] = [];
    const skipped: Id<"auctions">[] = [];
    for (const id of args.auctionIds) {
      const auction = await ctx.db.get(id);
      if (auction) {
        const oldStatus = auction.status;
        const newStatus = args.updates.status;

        if (newStatus === "active") {
          const patched = { ...auction, ...args.updates };
          try {
            validateAuctionStatus(patched, newStatus);
          } catch {
            skipped.push(id);
            continue;
          }
        }

        await ctx.db.patch(id, args.updates);
        updated.push(id);

        if (newStatus && oldStatus !== newStatus) {
          await adjustStatusCounters(ctx, oldStatus, newStatus);
        }
      } else {
        skipped.push(id);
      }
    }

    await logAudit(ctx, {
      action: "BULK_UPDATE_AUCTIONS",
      targetId: args.auctionIds.join(","),
      targetType: "auction",
      targetCount: updated.length,
      details: JSON.stringify({
        requestedCount: args.auctionIds.length,
        updatedCount: updated.length,
        skippedCount: skipped.length,
        updates: Object.keys(args.updates),
        preview: updated.slice(0, 3),
      }),
    });

    return { success: true, updated, skipped };
  },
});

/**
 * Result type for closeAuctionEarly mutation.
 */
interface CloseAuctionEarlyResult {
  success: boolean;
  finalStatus: string;
  winnerId?: string;
  winningAmount?: number;
  error?: string;
}

/**
 * Admin mutation to manually close an active auction early.
 * Determines winner based on highest bid, validates reserve price,
 * and updates auction status accordingly.
 */
export const closeAuctionEarly = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({
    success: v.boolean(),
    finalStatus: v.string(),
    winnerId: v.optional(v.string()),
    winningAmount: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<CloseAuctionEarlyResult> => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      return {
        success: false,
        finalStatus: "",
        error: "Not authorized",
      };
    }

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) {
      return {
        success: false,
        finalStatus: "",
        error: "Auction not found",
      };
    }

    if (auction.status !== "active") {
      return {
        success: false,
        finalStatus: "",
        error: "Auction has already been settled",
      };
    }

    const bids = await ctx.db
      .query("bids")
      .withIndex("by_auction", (q) => q.eq("auctionId", auction._id))
      .collect();

    const validBids = bids.filter((b: Doc<"bids">) => b.status !== "voided");
    const hasBids = validBids.length > 0;

    type AuctionStatus = "sold" | "unsold";
    let finalStatus: AuctionStatus;
    let winnerId: string | undefined;
    let winningAmount: number | undefined;

    let highestBid: Doc<"bids"> | undefined;
    if (hasBids) {
      highestBid = validBids.reduce(
        (prev: Doc<"bids">, current: Doc<"bids">) => {
          if (current.amount > prev.amount) return current;
          if (current.amount === prev.amount) {
            return current.timestamp < prev.timestamp ? current : prev;
          }
          return prev;
        }
      );
    }

    const reserveMet =
      hasBids &&
      highestBid !== undefined &&
      highestBid.amount >= auction.reservePrice;

    if (hasBids && reserveMet) {
      finalStatus = "sold";
      winnerId = highestBid!.bidderId;
      winningAmount = highestBid!.amount;
    } else {
      finalStatus = "unsold";
    }

    await ctx.db.patch(auction._id, {
      status: finalStatus,
      winnerId,
    });

    await updateCounter(ctx, "auctions", "active", -1);

    const authUser = await getAuthUser(ctx);
    const adminId = authUser ? resolveUserId(authUser) : "unknown";

    await logAudit(ctx, {
      action: "auction_early_closure",
      targetId: args.auctionId,
      targetType: "auction",
      details: JSON.stringify({
        adminId,
        title: auction.title,
        finalStatus,
        winnerId,
        winningAmount,
        reserveMet,
        bidCount: validBids.length,
        message:
          finalStatus === "sold"
            ? `Sold to ${winnerId} for ${winningAmount}`
            : "Reserve not met - marked as unsold",
      }),
    });

    return {
      success: true,
      finalStatus,
      winnerId,
      winningAmount,
    };
  },
});

export const updateAuctionHandler = async (
  ctx: MutationCtx,
  args: {
    auctionId: Id<"auctions">;
    updates: {
      title?: string;
      make?: string;
      model?: string;
      year?: number;
      operatingHours?: number;
      location?: string;
      description?: string;
      startingPrice?: number;
      reservePrice?: number;
      durationDays?: number;
      images?: {
        front?: string;
        engine?: string;
        cabin?: string;
        rear?: string;
        additional?: string[];
      };
      conditionChecklist?: {
        engine: boolean;
        hydraulics: boolean;
        tires: boolean;
        serviceHistory: boolean;
        notes?: string;
      };
    };
  }
) => {
  const authUser = await getAuthUser(ctx);
  if (!authUser) {
    throw new Error("Not authenticated");
  }
  const userId = resolveUserId(authUser);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  if (auction.sellerId !== userId) {
    throw new Error("Not authorized: You can only edit your own auctions");
  }

  if (auction.status !== "draft" && auction.status !== "pending_review") {
    throw new Error(
      "You can only edit auctions in draft or pending_review status"
    );
  }

  const { updates } = args;

  if (
    updates.durationDays !== undefined &&
    (updates.durationDays <= 0 || updates.durationDays > 365)
  ) {
    throw new ConvexError("Invalid duration: must be between 1 and 365 days");
  }

  if (updates.images?.additional && updates.images.additional.length > 6) {
    throw new ConvexError("Additional images limit exceeded (max 6)");
  }

  await ctx.db.patch(args.auctionId, updates);

  return { success: true };
};

export const updateAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
    updates: v.object({
      title: v.optional(v.string()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      year: v.optional(v.number()),
      operatingHours: v.optional(v.number()),
      location: v.optional(v.string()),
      description: v.optional(v.string()),
      startingPrice: v.optional(v.number()),
      reservePrice: v.optional(v.number()),
      durationDays: v.optional(v.number()),
      images: v.optional(
        v.object({
          front: v.optional(v.string()),
          engine: v.optional(v.string()),
          cabin: v.optional(v.string()),
          rear: v.optional(v.string()),
          additional: v.optional(v.array(v.string())),
        })
      ),
      conditionChecklist: v.optional(
        v.object({
          engine: v.boolean(),
          hydraulics: v.boolean(),
          tires: v.boolean(),
          serviceHistory: v.boolean(),
          notes: v.optional(v.string()),
        })
      ),
    }),
  },
  returns: v.object({ success: v.boolean() }),
  handler: updateAuctionHandler,
});

export const publishAuctionHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions"> }
) => {
  const authUser = await getAuthUser(ctx);
  if (!authUser) {
    throw new Error("Not authenticated");
  }
  const userId = resolveUserId(authUser);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  if (auction.sellerId !== userId) {
    throw new Error("Not authorized: You can only publish your own auctions");
  }

  if (auction.status !== "draft") {
    throw new Error("Only draft auctions can be published");
  }

  // TODO: Add extra validation to ensure required fields are present before publishing if needed.

  await ctx.db.patch(args.auctionId, { status: "pending_review" });

  await adjustStatusCounters(ctx, "draft", "pending_review");

  return { success: true };
};

export const publishAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: publishAuctionHandler,
});

export const updateConditionReportHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions">; storageId: string }
) => {
  const authUser = await getAuthUser(ctx);
  if (!authUser) {
    throw new Error("Not authenticated");
  }
  const userId = resolveUserId(authUser);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  if (auction.sellerId !== userId) {
    throw new Error("Not authorized: You can only update your own auctions");
  }

  if (auction.conditionReportUrl) {
    try {
      await ctx.storage.delete(auction.conditionReportUrl as Id<"_storage">);
    } catch (e) {
      console.warn("Failed to delete old condition report", e);
    }
  }

  await ctx.db.patch(args.auctionId, { conditionReportUrl: args.storageId });

  return { success: true };
};

export const updateConditionReport = mutation({
  args: {
    auctionId: v.id("auctions"),
    storageId: v.string(), // Accepts the storageId returned by upload
  },
  returns: v.object({ success: v.boolean() }),
  handler: updateConditionReportHandler,
});
