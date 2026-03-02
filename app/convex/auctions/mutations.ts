import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import {
  getCallerRole,
  getAuthenticatedUserId,
  getAuthUser,
  resolveUserId,
} from "../lib/auth";
import { normalizeImages, deleteAuctionImages } from "../lib/storage";
import { logAudit, updateCounter } from "../admin_utils";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

const EDITABLE_STATUSES = ["draft", "pending_review"] as const;
type EditableStatus = (typeof EDITABLE_STATUSES)[number];

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
 * Ensures an auction can be edited (must be in draft or pending_review).
 */
function assertEditable(auction: Doc<"auctions">): void {
  if (!EDITABLE_STATUSES.includes(auction.status as EditableStatus)) {
    throw new ConvexError(
      `Only ${EDITABLE_STATUSES.join(" or ")} auctions can be edited`
    );
  }
}

/**
 * Ensures the caller owns the auction.
 */
function assertOwnership(auction: Doc<"auctions">, userId: string): void {
  if (auction.sellerId !== userId) {
    throw new ConvexError("You can only modify your own auctions");
  }
}

/**
 * Validate that an auction record contains required fields for a target status.
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

/**
 * Update global auction counters when an auction changes status.
 */
async function adjustStatusCounters(
  ctx: MutationCtx,
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

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await getAuthenticatedUserId(ctx);
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

/**
 * Generic auction creation mutation.
 * Supports creating either a draft or a pending_review auction.
 */
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
    const userId = await getAuthenticatedUserId(ctx);

    const { durationDays, isDraft, ...restArgs } = args;

    if (durationDays <= 0 || durationDays > 365) {
      throw new ConvexError("Invalid duration: must be between 1 and 365 days");
    }

    if (restArgs.images.additional && restArgs.images.additional.length > 6) {
      throw new ConvexError("Additional images limit exceeded (max 6)");
    }

    const images = normalizeImages(restArgs.images);
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
    if (status === "pending_review") {
      await updateCounter(ctx, "auctions", "pending", 1);
    }

    return auctionId;
  },
});

/**
 * Save or update a draft auction.
 * Creates new draft if no auctionId provided, otherwise updates existing draft.
 */
export const saveDraft = mutation({
  args: {
    auctionId: v.optional(v.id("auctions")),
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
    const userId = await getAuthenticatedUserId(ctx);

    const { auctionId, durationDays, ...restArgs } = args;

    if (durationDays <= 0 || durationDays > 365) {
      throw new ConvexError("Invalid duration: must be between 1 and 365 days");
    }

    const images = normalizeImages(restArgs.images);

    if (auctionId) {
      const existing = await ctx.db.get(auctionId);
      if (!existing) {
        throw new ConvexError("Auction not found");
      }
      assertOwnership(existing, userId);
      assertEditable(existing);

      await ctx.db.patch(auctionId, {
        ...restArgs,
        images,
        durationDays,
      });

      return auctionId;
    }

    const newAuctionId = await ctx.db.insert("auctions", {
      ...restArgs,
      images,
      sellerId: userId,
      status: "draft",
      currentPrice: args.startingPrice,
      minIncrement: args.startingPrice < 10000 ? 100 : 500,
      durationDays,
    });

    await updateCounter(ctx, "auctions", "total", 1);

    return newAuctionId;
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
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  assertOwnership(auction, userId);
  assertEditable(auction);

  const updates = { ...args.updates };

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

  await logAudit(ctx, {
    action: "SELLER_UPDATE_AUCTION",
    targetId: args.auctionId,
    targetType: "auction",
    details: JSON.stringify({
      sellerId: userId,
      previousStatus: auction.status,
      updates: Object.keys(updates),
    }),
  });

  return { success: true };
};

/**
 * Update an auction. Only allowed for draft or pending_review status.
 * Once active, sold, or unsold - auction is locked from seller edits.
 */
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
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  assertOwnership(auction, userId);

  if (auction.status !== "draft") {
    throw new ConvexError("Only draft auctions can be published");
  }

  await ctx.db.patch(args.auctionId, { status: "pending_review" });

  await adjustStatusCounters(ctx, "draft", "pending_review");

  return { success: true };
};

/**
 * Submit a draft auction for admin review.
 * Transitions draft -> pending_review
 */
export const submitForReview = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) {
      throw new ConvexError("Auction not found");
    }

    assertOwnership(auction, userId);

    if (auction.status !== "draft") {
      throw new ConvexError("Only draft auctions can be submitted for review");
    }

    const hasImages =
      !Array.isArray(auction.images) &&
      (auction.images.front ||
        auction.images.engine ||
        auction.images.cabin ||
        auction.images.rear ||
        (auction.images.additional && auction.images.additional.length > 0));

    if (!hasImages) {
      throw new ConvexError("At least one image is required before submitting");
    }

    if (!auction.description || auction.description.trim().length === 0) {
      throw new ConvexError("Description is required before submitting");
    }

    if (auction.startingPrice <= 0 || auction.reservePrice <= 0) {
      throw new ConvexError("Valid pricing is required before submitting");
    }

    await ctx.db.patch(args.auctionId, {
      status: "pending_review",
    });

    await updateCounter(ctx, "auctions", "pending", 1);

    await logAudit(ctx, {
      action: "SUBMIT_FOR_REVIEW",
      targetId: args.auctionId,
      targetType: "auction",
      details: JSON.stringify({
        sellerId: userId,
        title: auction.title,
      }),
    });

    return { success: true };
  },
});

/**
 * Alias for submitForReview to maintain backward compatibility.
 */
export const publishAuction = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: publishAuctionHandler,
});

/**
 * Delete a draft auction.
 */
export const deleteDraft = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) {
      throw new ConvexError("Auction not found");
    }

    assertOwnership(auction, userId);

    if (auction.status !== "draft") {
      throw new ConvexError("Only draft auctions can be deleted");
    }

    await deleteAuctionImages(ctx, auction.images);

    await ctx.db.delete(args.auctionId);

    await logAudit(ctx, {
      action: "DELETE_DRAFT",
      targetId: args.auctionId,
      targetType: "auction",
      details: JSON.stringify({
        sellerId: userId,
        title: auction.title,
      }),
    });

    return { success: true };
  },
});

export const updateConditionReportHandler = async (
  ctx: MutationCtx,
  args: { auctionId: Id<"auctions">; storageId: string }
) => {
  const userId = await getAuthenticatedUserId(ctx);

  const auction = await ctx.db.get(args.auctionId);
  if (!auction) {
    throw new ConvexError("Auction not found");
  }

  assertOwnership(auction, userId);

  if (auction.conditionReportUrl) {
    try {
      await ctx.storage.delete(auction.conditionReportUrl as Id<"_storage">);
    } catch (e) {
      console.warn("Failed to delete old condition report", e);
    }
  }

  await ctx.db.patch(args.auctionId, {
    conditionReportUrl: args.storageId as Id<"_storage">,
  });

  return { success: true };
};

/**
 * Upload a condition report PDF for an auction.
 */
export const uploadConditionReport = mutation({
  args: {
    auctionId: v.id("auctions"),
    storageId: v.string(), // Accepts the storageId returned by upload
  },
  returns: v.object({ success: v.boolean() }),
  handler: updateConditionReportHandler,
});

/**
 * Delete a condition report from an auction.
 */
export const deleteConditionReport = mutation({
  args: { auctionId: v.id("auctions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) {
      throw new ConvexError("Auction not found");
    }

    assertOwnership(auction, userId);

    if (auction.conditionReportUrl) {
      try {
        await ctx.storage.delete(auction.conditionReportUrl as Id<"_storage">);
      } catch (e) {
        console.warn("Failed to delete condition report", e);
      }
    }

    await ctx.db.patch(args.auctionId, {
      conditionReportUrl: undefined,
    });

    return { success: true };
  },
});

const FLAG_THRESHOLD = 3;

/**
 * Flag an auction for review.
 * Auto-hides auction if it receives 3 or more flags.
 */
export const flagAuction = mutation({
  args: {
    auctionId: v.id("auctions"),
    reason: v.union(
      v.literal("misleading"),
      v.literal("inappropriate"),
      v.literal("suspicious"),
      v.literal("other")
    ),
    details: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), hideTriggered: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);

    const auction = await ctx.db.get(args.auctionId);
    if (!auction) {
      throw new ConvexError("Auction not found");
    }

    if (auction.sellerId === userId) {
      throw new ConvexError("You cannot flag your own auction");
    }

    const existingFlags = await ctx.db
      .query("auctionFlags")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
      .collect();

    const userHasFlagged = existingFlags.some(
      (flag) => flag.reporterId === userId && flag.status === "pending"
    );

    if (userHasFlagged) {
      throw new ConvexError("You have already flagged this auction");
    }

    await ctx.db.insert("auctionFlags", {
      auctionId: args.auctionId,
      reporterId: userId,
      reason: args.reason,
      details: args.details,
      status: "pending",
      createdAt: Date.now(),
    });

    let hideTriggered = false;

    const pendingFlags = existingFlags.filter((f) => f.status === "pending");
    if (pendingFlags.length + 1 >= FLAG_THRESHOLD) {
      if (auction.status === "active") {
        await ctx.db.patch(args.auctionId, {
          status: "pending_review",
        });

        await updateCounter(ctx, "auctions", "active", -1);
        await updateCounter(ctx, "auctions", "pending", 1);

        hideTriggered = true;
      }

      await logAudit(ctx, {
        action: "AUTO_HIDE_AUCTION_FLAGS",
        targetId: args.auctionId,
        targetType: "auction",
        details: JSON.stringify({
          flagCount: pendingFlags.length + 1,
          threshold: FLAG_THRESHOLD,
          hideTriggered,
          reason: args.reason,
        }),
      });
    }

    return { success: true, hideTriggered };
  },
});

/**
 * Dismiss a flag (admin only).
 */
export const dismissFlag = mutation({
  args: {
    flagId: v.id("auctionFlags"),
    dismissalReason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), auctionRestored: v.boolean() }),
  handler: async (ctx, args) => {
    const role = await getCallerRole(ctx);
    if (role !== "admin") {
      throw new Error("Not authorized: Admin privileges required");
    }

    const flag = await ctx.db.get(args.flagId);
    if (!flag) {
      throw new ConvexError("Flag not found");
    }

    if (flag.status !== "pending") {
      throw new ConvexError("Flag has already been reviewed");
    }

    await ctx.db.patch(args.flagId, {
      status: "dismissed",
    });

    let auctionRestored = false;

    const auction = await ctx.db.get(flag.auctionId);
    if (auction && auction.status === "pending_review") {
      const remainingFlags = await ctx.db
        .query("auctionFlags")
        .withIndex("by_auction_status", (q) =>
          q.eq("auctionId", flag.auctionId).eq("status", "pending")
        )
        .collect();

      if (remainingFlags.length === 0) {
        await ctx.db.patch(flag.auctionId, {
          status: "active",
        });

        await updateCounter(ctx, "auctions", "pending", -1);
        await updateCounter(ctx, "auctions", "active", 1);

        auctionRestored = true;
      }
    }

    const authUser = await getAuthUser(ctx);
    const adminId = authUser ? resolveUserId(authUser) : "unknown";

    await logAudit(ctx, {
      action: "DISMISS_FLAG",
      targetId: args.flagId,
      targetType: "auctionFlag",
      details: JSON.stringify({
        adminId,
        auctionId: flag.auctionId,
        reason: flag.reason,
        dismissalReason: args.dismissalReason,
        auctionRestored,
      }),
    });

    return { success: true, auctionRestored };
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
 * Admin mutation to manually close an active auction early.
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
