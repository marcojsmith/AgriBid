import { v } from "convex/values";

import { query, mutation } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { logAudit } from "../admin_utils";
import type { Id } from "../_generated/dataModel";

const MIN_PERCENTAGE = 0.0001;
const MAX_PERCENTAGE = 1.0;
const MAX_FIXED_FEE = 1000000;
const MAX_NAME_LENGTH = 100;

function validateFeeValue(feeType: string, value: number): void {
  if (feeType === "percentage") {
    if (value < MIN_PERCENTAGE || value > MAX_PERCENTAGE) {
      throw new Error(
        `Percentage fee must be between ${MIN_PERCENTAGE * 100}% and ${MAX_PERCENTAGE * 100}%`
      );
    }
  } else if (feeType === "fixed") {
    if (value <= 0) {
      throw new Error("Fixed fee must be greater than 0");
    }
    if (value > MAX_FIXED_FEE) {
      throw new Error(`Fixed fee cannot exceed ${MAX_FIXED_FEE}`);
    }
  }
}

async function checkDuplicateName(
  ctx: QueryCtx | MutationCtx,
  name: string,
  excludeId?: Id<"platformFees">
): Promise<void> {
  const existing = await ctx.db
    .query("platformFees")
    .filter((q) => q.eq(q.field("name"), name))
    .filter((q) => q.neq(q.field("isActive"), false))
    .collect();

  const filtered = excludeId
    ? existing.filter((f) => f._id !== excludeId)
    : existing;

  if (filtered.length > 0) {
    throw new Error(`A fee with name "${name}" already exists`);
  }
}

/**
 * Output type representing a platform fee configuration.
 * @property _id - Unique identifier for the platform fee
 * @property _creationTime - Timestamp when the fee was created
 * @property name - Display name of the fee
 * @property description - Optional description of the fee
 * @property feeType - Method of fee calculation: "percentage" or "fixed"
 * @property value - Numeric value of the fee (percentage 0-1 or fixed amount)
 * @property appliesTo - Which party bears the fee: "buyer", "seller", or "both"
 * @property isActive - Whether the fee is currently active
 * @property visibleToBuyer - Whether the fee is shown to buyers
 * @property visibleToSeller - Whether the fee is shown to sellers
 * @property sortOrder - Display order for the fee
 * @property createdAt - Timestamp when the fee was created
 * @property updatedAt - Timestamp when the fee was last updated
 * @property deletedAt - Timestamp when the fee was soft-deleted (if applicable)
 */
export interface PlatformFeeOutput {
  _id: Id<"platformFees">;
  _creationTime: number;
  name: string;
  description?: string;
  feeType: "percentage" | "fixed";
  value: number;
  appliesTo: "buyer" | "seller" | "both";
  isActive: boolean;
  visibleToBuyer: boolean;
  visibleToSeller: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export const getPlatformFees = query({
  args: {},
  returns: v.object({
    activeFees: v.array(
      v.object({
        _id: v.id("platformFees"),
        _creationTime: v.number(),
        name: v.string(),
        description: v.optional(v.string()),
        feeType: v.union(v.literal("percentage"), v.literal("fixed")),
        value: v.number(),
        appliesTo: v.union(
          v.literal("buyer"),
          v.literal("seller"),
          v.literal("both")
        ),
        isActive: v.boolean(),
        visibleToBuyer: v.boolean(),
        visibleToSeller: v.boolean(),
        sortOrder: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
      })
    ),
    allFees: v.array(
      v.object({
        _id: v.id("platformFees"),
        _creationTime: v.number(),
        name: v.string(),
        description: v.optional(v.string()),
        feeType: v.union(v.literal("percentage"), v.literal("fixed")),
        value: v.number(),
        appliesTo: v.union(
          v.literal("buyer"),
          v.literal("seller"),
          v.literal("both")
        ),
        isActive: v.boolean(),
        visibleToBuyer: v.boolean(),
        visibleToSeller: v.boolean(),
        sortOrder: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allFees = await ctx.db
      .query("platformFees")
      .withIndex("by_sortOrder")
      .collect();

    const activeFees = allFees.filter((f) => f.isActive);

    return { activeFees, allFees };
  },
});

/**
 * Creates a new platform fee configuration.
 * @requires Admin authentication
 * @param name - Display name for the fee (1-100 characters)
 * @param description - Optional description of the fee
 * @param feeType - Method of fee calculation: "percentage" or "fixed"
 * @param value - Numeric value (percentage 0-1 or fixed amount)
 * @param appliesTo - Which party bears the fee: "buyer", "seller", or "both"
 * @param isActive - Whether the fee is active
 * @param visibleToBuyer - Whether buyers can see the fee
 * @param visibleToSeller - Whether sellers can see the fee
 * @returns { success: boolean, feeId: id } on success
 * @throws Error if name is empty/long, value is invalid, or duplicate name exists
 * @sideEffects Inserts new platformFee record, computes sortOrder, sets timestamps, logs audit entry
 */
export const createPlatformFee = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    feeType: v.union(v.literal("percentage"), v.literal("fixed")),
    value: v.number(),
    appliesTo: v.union(
      v.literal("buyer"),
      v.literal("seller"),
      v.literal("both")
    ),
    isActive: v.boolean(),
    visibleToBuyer: v.boolean(),
    visibleToSeller: v.boolean(),
  },
  returns: v.object({
    success: v.boolean(),
    feeId: v.id("platformFees"),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const name = args.name.trim();
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
      throw new Error(
        `Fee name must be between 1 and ${MAX_NAME_LENGTH} characters`
      );
    }

    validateFeeValue(args.feeType, args.value);

    await checkDuplicateName(ctx, name);

    const maxSortOrder = await ctx.db
      .query("platformFees")
      .collect()
      .then((fees) => Math.max(0, ...fees.map((f) => f.sortOrder)));

    const now = Date.now();
    const feeId = await ctx.db.insert("platformFees", {
      name,
      description: args.description?.trim(),
      feeType: args.feeType,
      value: args.value,
      appliesTo: args.appliesTo,
      isActive: args.isActive,
      visibleToBuyer: args.visibleToBuyer,
      visibleToSeller: args.visibleToSeller,
      sortOrder: maxSortOrder + 1,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: "CREATE_FEE",
      targetId: feeId,
      targetType: "platformFee",
      details: `Created fee: ${name} (${args.feeType}, ${args.value}, applies to ${args.appliesTo})`,
    });

    return { success: true, feeId };
  },
});

/**
 * Partially updates an existing platform fee.
 * @requires Admin authentication
 * @param feeId - ID of the fee to update
 * @param name - Optional new name (1-100 characters)
 * @param description - Optional new description
 * @param feeType - Optional new fee type ("percentage" or "fixed")
 * @param value - Optional new value
 * @param appliesTo - Optional new target party
 * @param isActive - Optional active status
 * @param visibleToBuyer - Optional buyer visibility
 * @param visibleToSeller - Optional seller visibility
 * @param sortOrder - Optional new sort order
 * @returns { success: boolean } on success
 * @throws Error if fee not found, validation fails, or duplicate name
 * @sideEffects Patches fee record, updates timestamp, logs audit entry
 */
export const updatePlatformFee = mutation({
  args: {
    feeId: v.id("platformFees"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    feeType: v.optional(v.union(v.literal("percentage"), v.literal("fixed"))),
    value: v.optional(v.number()),
    appliesTo: v.optional(
      v.union(v.literal("buyer"), v.literal("seller"), v.literal("both"))
    ),
    isActive: v.optional(v.boolean()),
    visibleToBuyer: v.optional(v.boolean()),
    visibleToSeller: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { feeId, ...updates } = args;
    const fee = await ctx.db.get(feeId);

    if (!fee) {
      throw new Error("Fee not found");
    }

    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
        throw new Error(
          `Fee name must be between 1 and ${MAX_NAME_LENGTH} characters`
        );
      }
      await checkDuplicateName(ctx, name, feeId);
      updates.name = name;
    }

    if (updates.description !== undefined) {
      updates.description = updates.description.trim();
    }

    if (updates.value !== undefined && updates.feeType !== undefined) {
      validateFeeValue(updates.feeType, updates.value);
    } else if (updates.value !== undefined) {
      validateFeeValue(fee.feeType, updates.value);
    } else if (updates.feeType !== undefined) {
      validateFeeValue(updates.feeType, fee.value);
    }

    const updatedFields = {
      ...updates,
      updatedAt: Date.now(),
    };

    await ctx.db.patch(feeId, updatedFields);

    await logAudit(ctx, {
      action: "UPDATE_FEE",
      targetId: feeId,
      targetType: "platformFee",
      details: `Updated fee: ${fee.name}`,
    });

    return { success: true };
  },
});

/**
 * Soft-deletes a platform fee by marking it inactive.
 * Historical auctionFee records referencing this fee will remain.
 * @requires Admin authentication
 * @param feeId - ID of the fee to delete
 * @returns { success: boolean } on success
 * @throws Error if fee not found
 * @sideEffects Sets isActive to false, adds deletedAt timestamp, logs audit entry
 */
export const deletePlatformFee = mutation({
  args: {
    feeId: v.id("platformFees"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const fee = await ctx.db.get(args.feeId);

    if (!fee) {
      throw new Error("Fee not found");
    }

    await ctx.db.patch(args.feeId, {
      isActive: false,
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "SOFT_DELETE_FEE",
      targetId: args.feeId,
      targetType: "platformFee",
      details: `Soft-deleted fee: ${fee.name}`,
    });

    return { success: true };
  },
});

export const reorderPlatformFees = mutation({
  args: {
    feeIds: v.array(v.id("platformFees")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    for (let i = 0; i < args.feeIds.length; i++) {
      const feeId = args.feeIds[i];
      const fee = await ctx.db.get(feeId);

      if (!fee) {
        throw new Error(`Fee not found: ${feeId}`);
      }

      await ctx.db.patch(feeId, {
        sortOrder: i,
        updatedAt: Date.now(),
      });
    }

    await logAudit(ctx, {
      action: "REORDER_FEES",
      targetType: "platformFee",
      details: `Reordered ${args.feeIds.length} fees`,
    });

    return { success: true };
  },
});

export const getFeeStats = query({
  args: {},
  returns: v.object({
    totalFeesCollected: v.number(),
    buyerFeesTotal: v.number(),
    sellerFeesTotal: v.number(),
    feeBreakdown: v.array(
      v.object({
        feeName: v.string(),
        totalAmount: v.number(),
        count: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allAuctionFees = await ctx.db.query("auctionFees").collect();

    let totalFeesCollected = 0;
    let buyerFeesTotal = 0;
    let sellerFeesTotal = 0;

    const feeMap = new Map<string, { totalAmount: number; count: number }>();

    for (const fee of allAuctionFees) {
      totalFeesCollected += fee.calculatedAmount;

      if (fee.appliedTo === "buyer") {
        buyerFeesTotal += fee.calculatedAmount;
      } else if (fee.appliedTo === "seller") {
        sellerFeesTotal += fee.calculatedAmount;
      }

      const existing = feeMap.get(fee.feeName);
      if (existing) {
        existing.totalAmount += fee.calculatedAmount;
        existing.count += 1;
      } else {
        feeMap.set(fee.feeName, {
          totalAmount: fee.calculatedAmount,
          count: 1,
        });
      }
    }

    const feeBreakdown = Array.from(feeMap.entries()).map(
      ([feeName, data]) => ({
        feeName,
        totalAmount: data.totalAmount,
        count: data.count,
      })
    );

    return {
      totalFeesCollected,
      buyerFeesTotal,
      sellerFeesTotal,
      feeBreakdown,
    };
  },
});

export const getAuctionFees = query({
  args: {
    auctionId: v.id("auctions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("auctionFees"),
      _creationTime: v.number(),
      auctionId: v.id("auctions"),
      feeId: v.id("platformFees"),
      feeName: v.string(),
      appliedTo: v.union(v.literal("buyer"), v.literal("seller")),
      feeType: v.union(v.literal("percentage"), v.literal("fixed")),
      rate: v.number(),
      salePrice: v.number(),
      calculatedAmount: v.number(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const fees = await ctx.db
      .query("auctionFees")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
      .collect();

    return fees;
  },
});

/**
 * Returns auction fees for a specific user (winner or seller).
 * @param auctionId - ID of the auction
 * @param userId - ID of the user requesting fees
 * @returns Object with buyerFees and sellerFees arrays containing feeName, feeType, rate, calculatedAmount
 * @authorization Returns empty arrays if caller is neither auction winner nor seller
 * @sideEffects Read-only query; filters out inactive platform fees
 */
export const getAuctionFeesForUser = query({
  args: {
    auctionId: v.id("auctions"),
    userId: v.string(),
  },
  returns: v.object({
    buyerFees: v.array(
      v.object({
        feeName: v.string(),
        feeType: v.union(v.literal("percentage"), v.literal("fixed")),
        rate: v.number(),
        calculatedAmount: v.number(),
      })
    ),
    sellerFees: v.array(
      v.object({
        feeName: v.string(),
        feeType: v.union(v.literal("percentage"), v.literal("fixed")),
        rate: v.number(),
        calculatedAmount: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const auction = await ctx.db.get(args.auctionId);

    if (!auction) {
      throw new Error("Auction not found");
    }

    if (auction.winnerId !== args.userId && auction.sellerId !== args.userId) {
      return { buyerFees: [], sellerFees: [] };
    }

    const fees = await ctx.db
      .query("auctionFees")
      .withIndex("by_auction", (q) => q.eq("auctionId", args.auctionId))
      .collect();

    const activeFeeIds = (
      await ctx.db
        .query("platformFees")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect()
    ).map((f) => f._id);

    const buyerFees: Array<{
      feeName: string;
      feeType: "percentage" | "fixed";
      rate: number;
      calculatedAmount: number;
    }> = [];
    const sellerFees: Array<{
      feeName: string;
      feeType: "percentage" | "fixed";
      rate: number;
      calculatedAmount: number;
    }> = [];

    for (const fee of fees) {
      if (!activeFeeIds.includes(fee.feeId)) continue;

      const platformFee = await ctx.db.get(fee.feeId);
      if (!platformFee) continue;

      const feeData = {
        feeName: fee.feeName,
        feeType: fee.feeType,
        rate: fee.rate,
        calculatedAmount: fee.calculatedAmount,
      };

      if (fee.appliedTo === "buyer") {
        buyerFees.push(feeData);
      } else if (fee.appliedTo === "seller") {
        sellerFees.push(feeData);
      }
    }

    return { buyerFees, sellerFees };
  },
});
