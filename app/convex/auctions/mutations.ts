import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getCallerRole } from "../users";
import { logAudit, updateCounter } from "../admin_utils";
import { getAuthUser, resolveUserId } from "../lib/auth";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

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

    const { durationDays, ...restArgs } = args;

    if (durationDays <= 0 || durationDays > 365) {
      throw new Error("Invalid duration: must be between 1 and 365 days");
    }

    if (restArgs.images.additional && restArgs.images.additional.length > 6) {
      throw new Error("Additional images limit exceeded (max 6)");
    }

    const images = {
      ...restArgs.images,
      additional: restArgs.images.additional || [],
    };

    const auctionId = await ctx.db.insert("auctions", {
      ...restArgs,
      images,
      sellerId: userId,
      status: "pending_review",
      currentPrice: args.startingPrice,
      minIncrement: args.startingPrice < 10000 ? 100 : 500,
      durationDays: durationDays,
    });

    await updateCounter(ctx, "auctions", "total", 1);
    await updateCounter(ctx, "auctions", "pending", 1);

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
    if (!auction) throw new Error("Auction not found");
    if (auction.status !== "pending_review") {
      throw new Error("Only auctions in pending_review can be approved");
    }

    const durationDays = args.durationDays ?? auction.durationDays ?? 7;
    if (durationDays <= 0 || durationDays > 365) {
      throw new Error("Invalid duration: must be between 1 and 365 days");
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
 * Validates that an auction has the required fields for its status.
 * Currently only validates the "active" status (requires endTime).
 * TODO: Add validation for other statuses as needed, e.g., "sold" should require winnerId.
 * Throws an error if validation fails.
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
    if (!auction) throw new Error("Auction not found");
    if (auction.status !== "pending_review") {
      throw new Error("Only auctions in pending_review can be rejected");
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
