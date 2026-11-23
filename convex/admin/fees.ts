import { v } from "convex/values";

import { query, mutation } from "../_generated/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requireAdmin, getAuthUser, resolveUserId } from "../lib/auth";
import { logAudit } from "../admin_utils";
import {
  AUCTION_BUYER_FEE_NAME,
  AUCTION_SELLER_FEE_NAME,
  PLATFORM_BUYER_FEE_NAME,
  computeResolvedDefaultFees,
} from "../auctions/internal";
import { resolveBuyerPremium } from "../lib/buyerPremium";
import type { Doc, Id } from "../_generated/dataModel";

const MIN_PERCENTAGE = 0.0001;
const MAX_PERCENTAGE = 1.0;
const MAX_FIXED_FEE = 1000000;
const MAX_NAME_LENGTH = 100;

function validateFeeValue(feeType: string, value: number): void {
  if (feeType === "percentage") {
    if (value < MIN_PERCENTAGE || value > MAX_PERCENTAGE) {
      throw new Error(
        `Percentage fee must be between ${String(MIN_PERCENTAGE * 100)}% and ${String(MAX_PERCENTAGE * 100)}%`
      );
    }
  } else if (feeType === "fixed") {
    if (value <= 0) {
      throw new Error("Fixed fee must be greater than 0");
    }
    if (value > MAX_FIXED_FEE) {
      throw new Error(`Fixed fee cannot exceed ${String(MAX_FIXED_FEE)}`);
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
    .withIndex("by_name", (q) => q.eq("name", name))
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
 * Side effects: inserts new platformFee record, computes sortOrder, sets timestamps, logs audit entry.
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
        `Fee name must be between 1 and ${String(MAX_NAME_LENGTH)} characters`
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
      details: `Created fee: ${name} (${args.feeType}, ${String(args.value)}, applies to ${args.appliesTo})`,
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
 * Side effects: patches fee record, updates timestamp, logs audit entry.
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
    const fee = await ctx.db.get("platformFees", feeId);

    if (!fee) {
      throw new Error("Fee not found");
    }

    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
        throw new Error(
          `Fee name must be between 1 and ${String(MAX_NAME_LENGTH)} characters`
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

    await ctx.db.patch("platformFees", feeId, updatedFields);

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
 * Historical lotFee records referencing this fee will remain.
 * @requires Admin authentication
 * @param feeId - ID of the fee to delete
 * @returns { success: boolean } on success
 * @throws Error if fee not found
 * Side effects: sets isActive to false, adds deletedAt timestamp, logs audit entry.
 */
export const deletePlatformFee = mutation({
  args: {
    feeId: v.id("platformFees"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const fee = await ctx.db.get("platformFees", args.feeId);

    if (!fee) {
      throw new Error("Fee not found");
    }

    await ctx.db.patch("platformFees", args.feeId, {
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

    for (const [i, feeId] of args.feeIds.entries()) {
      const fee = await ctx.db.get("platformFees", feeId);

      if (!fee) {
        throw new Error(`Fee not found: ${feeId}`);
      }

      await ctx.db.patch("platformFees", feeId, {
        sortOrder: i,
        updatedAt: Date.now(),
      });
    }

    await logAudit(ctx, {
      action: "REORDER_FEES",
      targetType: "platformFee",
      details: `Reordered ${String(args.feeIds.length)} fees`,
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

    const allLotFees = await ctx.db.query("lotFees").collect();

    let totalFeesCollected = 0;
    let buyerFeesTotal = 0;
    let sellerFeesTotal = 0;

    const feeMap = new Map<string, { totalAmount: number; count: number }>();

    for (const fee of allLotFees) {
      totalFeesCollected += fee.calculatedAmount;

      if (fee.appliedTo === "buyer") {
        buyerFeesTotal += fee.calculatedAmount;
      } else {
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

export const getLotFees = query({
  args: {
    lotId: v.id("lots"),
  },
  returns: v.array(
    v.object({
      _id: v.id("lotFees"),
      _creationTime: v.number(),
      lotId: v.id("lots"),
      feeId: v.optional(v.id("platformFees")),
      source: v.optional(
        v.union(
          v.literal("auction"),
          v.literal("fee_row"),
          v.literal("platform")
        )
      ),
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
      .query("lotFees")
      .withIndex("by_lot", (q) => q.eq("lotId", args.lotId))
      .collect();

    return fees;
  },
});

/** A fee line as shown to a lot's buyer or seller. */
interface LotFeeLine {
  feeName: string;
  feeType: "percentage" | "fixed";
  rate: number;
  calculatedAmount: number;
}

/**
 * Whether a lot's fees are final and must be read from the `lotFees` ledger:
 * it settled (`sold`/`unsold` with `settledAt`) or already has ledger rows.
 *
 * @param lot - The lot.
 * @param rows - The lot's `lotFees` rows.
 * @returns True when fee reads must use only the persisted rows.
 */
function isLotSettled(lot: Doc<"lots">, rows: Doc<"lotFees">[]): boolean {
  return (
    rows.length > 0 ||
    ((lot.status === "sold" || lot.status === "unsold") &&
      lot.settledAt !== undefined)
  );
}

/**
 * Fee lines of a settled lot, read ONLY from its persisted `lotFees` ledger
 * (what settlement charged). It never resolves premium/commission sources and
 * never looks at the current fee rows, `buyer_premium_pct` or auction defaults.
 *
 * Legacy fallback: a lot settled before the premium/commission was persisted
 * has no percentage ledger row for a side; if its snapshot exists, the
 * snapshot-derived line is shown for that side (a `platform`-sourced legacy
 * snapshot is the assignment-time value, a best-effort display only).
 *
 * @param lot - The settled lot.
 * @param rows - The lot's `lotFees` rows.
 * @returns The buyer and seller fee lines.
 */
function settledLotFeeLines(
  lot: Doc<"lots">,
  rows: Doc<"lotFees">[]
): { buyerFees: LotFeeLine[]; sellerFees: LotFeeLine[] } {
  const buyerFees: LotFeeLine[] = [];
  const sellerFees: LotFeeLine[] = [];
  for (const row of rows) {
    const line: LotFeeLine = {
      feeName: row.feeName,
      feeType: row.feeType,
      rate: row.rate,
      calculatedAmount: row.calculatedAmount,
    };
    (row.appliedTo === "buyer" ? buyerFees : sellerFees).push(line);
  }

  const salePrice = lot.currentPrice;
  const hasPercentage = (lines: LotFeeLine[]): boolean =>
    lines.some((line) => line.feeType === "percentage");
  const legacyLine = (feeName: string, rate: number): LotFeeLine => ({
    feeName,
    feeType: "percentage",
    rate,
    calculatedAmount: Math.round(salePrice * rate * 100) / 100,
  });

  if (!hasPercentage(buyerFees) && lot.resolvedBuyerPremiumPct !== undefined) {
    buyerFees.push(
      legacyLine(
        lot.premiumSource === "platform"
          ? PLATFORM_BUYER_FEE_NAME
          : AUCTION_BUYER_FEE_NAME,
        lot.resolvedBuyerPremiumPct
      )
    );
  }
  if (
    !hasPercentage(sellerFees) &&
    lot.resolvedSellerCommissionPct !== undefined
  ) {
    sellerFees.push(
      legacyLine(AUCTION_SELLER_FEE_NAME, lot.resolvedSellerCommissionPct)
    );
  }
  return { buyerFees, sellerFees };
}

/**
 * Returns lot fees for the authenticated caller (winner or seller).
 * @param ctx - Query context
 * @param args - Handler arguments
 * @param args.lotId - ID of the lot
 * @returns Object with buyerFees and sellerFees arrays containing feeName, feeType, rate, calculatedAmount
 * Authorization: returns empty arrays if caller is unauthenticated or is neither lot winner nor seller.
 * Side effects: read-only query.
 *
 * Settled lots (see `isLotSettled`) are read ONLY from the persisted `lotFees`
 * ledger written by settlement, so later fee-row, `buyer_premium_pct` or
 * auction-default changes never alter them (see `settledLotFeeLines`).
 *
 * Live (unsettled) lots show estimates derived from the lot's single resolved
 * buyer premium (auction snapshot or platform default read now; see
 * `resolveBuyerPremium`) and its snapshotted seller commission, applied to the
 * current `currentPrice`. Fee rows are only charged (and shown) at settlement.
 */
export const getLotFeesForUserHandler = async (
  ctx: QueryCtx,
  args: { lotId: Id<"lots"> }
) => {
  const authUser = await getAuthUser(ctx);
  if (!authUser) {
    return { buyerFees: [], sellerFees: [] };
  }
  const callerId = resolveUserId(authUser);

  const lot = await ctx.db.get("lots", args.lotId);

  if (!lot) {
    throw new Error("Lot not found");
  }

  if (lot.winnerId !== callerId && lot.sellerId !== callerId) {
    return { buyerFees: [], sellerFees: [] };
  }

  const fees = await ctx.db
    .query("lotFees")
    .withIndex("by_lot", (q) => q.eq("lotId", args.lotId))
    .collect();

  if (isLotSettled(lot, fees)) {
    return settledLotFeeLines(lot, fees);
  }

  // Live estimate: the lot has no ledger rows yet, so only the single resolved
  // buyer premium (see `resolveBuyerPremium`) and seller commission (see
  // `resolveSellerCommission`) apply, read from the current settings.
  const buyerFees: LotFeeLine[] = [];
  const sellerFees: LotFeeLine[] = [];
  const buyerPremium = await resolveBuyerPremium(ctx, lot);
  for (const fee of computeResolvedDefaultFees(
    lot,
    lot.currentPrice,
    buyerPremium
  )) {
    const line: LotFeeLine = {
      feeName: fee.feeName,
      feeType: "percentage",
      rate: fee.rate,
      calculatedAmount: fee.calculatedAmount,
    };
    (fee.appliedTo === "buyer" ? buyerFees : sellerFees).push(line);
  }

  return { buyerFees, sellerFees };
};

export const getLotFeesForUser = query({
  args: {
    lotId: v.id("lots"),
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
  handler: getLotFeesForUserHandler,
});
