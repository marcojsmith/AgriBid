import { v } from "convex/values";

import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUser, resolveUserId } from "./lib/auth";
import { encryptPII, decryptPII } from "./lib/encryption";
import type { Doc } from "./_generated/dataModel";

/**
 * Standard counter fields to ensure type safety across the admin utilities.
 */
export type CounterField =
  | "total"
  | "active"
  | "pending"
  | "verified"
  | "open"
  | "resolved"
  | "draft"
  | "salesVolume"
  | "soldCount"
  | "buyerTotal"
  | "sellerTotal";

/**
 * Fetch a counter document by name.
 *
 * @param ctx - Query or Mutation context
 * @param name - The identifier of the counter (e.g., "auctions", "profiles")
 * @returns The counter document or null if not found
 */
export async function getCounter(ctx: QueryCtx | MutationCtx, name: string) {
  return await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
}

/**
 * Interface representing a Convex query object with basic methods.
 */
interface ConvexQuery<T> {
  collect: () => Promise<T[]>;
  count?: () => Promise<number>;
}

/**
 * Count results from a query using the most efficient method available.
 *
 * Prefers ctx.db.count() if the query is a simple table scan or index query.
 *
 * @param query - A Convex query object
 * @returns The total number of items
 */
export async function countQuery<T>(query: ConvexQuery<T>) {
  // Use .count() if available (Convex 1.11+)
  if (typeof query.count === "function") {
    return await query.count();
  }
  const results = await query.collect();
  return results.length;
}

/**
 * Sum a specific numeric field from a query.
 *
 * @param query - A Convex query object
 * @param field - The field to sum
 * @returns Object containing the total sum and the count of items processed
 */
export async function sumQuery<T extends Record<string, unknown>>(
  query: ConvexQuery<T>,
  field: keyof T
) {
  const results = await query.collect();
  let sum = 0;
  let count = 0;

  for (const item of results) {
    const { [field]: val } = item;
    if (typeof val === "number") {
      sum += val;
      count++;
    }
  }

  return { sum, count };
}

/**
 * Standardized user counting logic across the platform.
 *
 * Prioritizes the 'profiles' counter for performance, but falls back to
 * database scans if specific filtered counts are needed.
 *
 * @param ctx - Query or Mutation context
 * @param options - Filtering options
 * @param options.isVerified - Optional boolean to filter by verification status
 * @param options.kycStatus - Optional status to filter by KYC state
 * @param options.role - Optional role to filter by user role
 * @param options.useCounter - Optional flag to use pre-computed counters instead of scans
 * @returns Total number of matching users
 */
export async function countUsers(
  ctx: QueryCtx | MutationCtx,
  options: {
    isVerified?: boolean;
    kycStatus?: "pending" | "verified" | "rejected";
    role?: "buyer" | "seller" | "admin";
    useCounter?: boolean;
  } = {}
) {
  const hasFilters =
    options.isVerified !== undefined ||
    options.kycStatus !== undefined ||
    options.role !== undefined;

  // Use pre-computed counter if requested and possible (only for single-metric cases)
  if (options.useCounter && !hasFilters) {
    const counter = await getCounter(ctx, "profiles");
    if (counter) return counter.total;
  }

  // Optimized paths for common single filters using indexes
  if (
    options.isVerified !== undefined &&
    options.kycStatus === undefined &&
    options.role === undefined
  ) {
    if (options.useCounter) {
      const counter = await getCounter(ctx, "profiles");
      if (counter) {
        if (options.isVerified) return counter.verified ?? 0;
        return counter.total - (counter.verified ?? 0);
      }
    }
    const isVerified = options.isVerified;
    return await countQuery(
      ctx.db
        .query("profiles")
        .withIndex("by_isVerified", (q) => q.eq("isVerified", isVerified))
    );
  }

  if (
    options.kycStatus !== undefined &&
    options.isVerified === undefined &&
    options.role === undefined
  ) {
    if (options.useCounter && options.kycStatus === "pending") {
      const counter = await getCounter(ctx, "profiles");
      if (counter) return counter.pending ?? 0;
    }
    return await countQuery(
      ctx.db
        .query("profiles")
        .withIndex("by_kycStatus", (q) => q.eq("kycStatus", options.kycStatus))
    );
  }

  if (
    options.role !== undefined &&
    options.isVerified === undefined &&
    options.kycStatus === undefined
  ) {
    const role = options.role;
    return await countQuery(
      ctx.db.query("profiles").withIndex("by_role", (q) => q.eq("role", role))
    );
  }

  // Complex case: Multiple filters or no index match
  // Choose the best index if possible, then filter manually for others in memory
  let results: Doc<"profiles">[];

  if (options.role !== undefined) {
    const role = options.role;
    results = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", role))
      .collect();
  } else if (options.kycStatus !== undefined) {
    results = await ctx.db
      .query("profiles")
      .withIndex("by_kycStatus", (q) => q.eq("kycStatus", options.kycStatus))
      .collect();
  } else {
    // Fallback to full scan if no role or kycStatus index can be used.
    // isVerified index is only used in the optimized single-filter path.
    results = await ctx.db.query("profiles").collect();
  }

  return results.filter((p) => {
    if (options.role !== undefined && p.role !== options.role) return false;
    if (options.kycStatus !== undefined && p.kycStatus !== options.kycStatus)
      return false;
    if (options.isVerified !== undefined && p.isVerified !== options.isVerified)
      return false;
    return true;
  }).length;
}

/**
 * Create an audit log entry for the currently authenticated admin or system process.
 *
 * @param ctx - Convex mutation context
 * @param args - The audit log entry fields
 * @param args.action - Short identifier of the action performed (for example `delete_user` or `update_settings`)
 * @param args.targetId - Optional identifier of the resource affected by the action
 * @param args.targetType - Optional type or category of the resource (for example `user` or `project`)
 * @param args.details - Optional free-form details or context about the action
 * @param args.targetCount - Optional number of targets affected by the action
 * @param args.system - Whether the action was performed by the system itself
 */
export async function logAudit(
  ctx: MutationCtx,
  args: {
    action: string;
    targetId?: string;
    targetType?: string;
    details?: string;
    targetCount?: number;
    system?: boolean;
  }
) {
  const authUser = await getAuthUser(ctx);
  let adminId: string;

  if (authUser) {
    adminId = authUser.userId ?? authUser._id;
  } else if (args.system === true) {
    adminId = "SYSTEM";
  } else {
    adminId = "UNAUTHENTICATED";
  }

  await ctx.db.insert("auditLogs", {
    adminId,
    action: args.action,
    targetId: args.targetId,
    targetType: args.targetType,
    details: args.details,
    targetCount: args.targetCount,
    timestamp: Date.now(),
  });

  try {
    await updateCounter(ctx, "auditLogs", "total", 1);
  } catch (err) {
    console.warn("Failed to update auditLogs counter:", err);
  }
}

// Re-export encryption functions from lib/encryption for backward compatibility
export { encryptPII, decryptPII, resolveUserId };

/**
 * Increment, decrement, or set a named counter's numeric field and persist the change.
 *
 * @param ctx - Convex mutation context
 * @param name - The identifier of the counter (for example `auctions`, `profiles`, `support`, `announcements`)
 * @param field - The counter field to adjust (for example `total`, `active`, `pending`, `verified`, `open`, `resolved`)
 * @param delta - The amount to change the field by (or the absolute value if absolute is true)
 * @param absolute - If true, sets the counter to exactly delta instead of adding delta to current value
 */
export async function updateCounter(
  ctx: MutationCtx,
  name: string,
  field: CounterField,
  delta: number,
  absolute?: boolean
) {
  const counter = await getCounter(ctx, name);

  if (counter) {
    const { [field]: rawValue } = counter;
    const currentValue = rawValue ?? 0;
    const newValue = absolute ? delta : currentValue + delta;

    if (newValue < 0) {
      console.warn(
        `Counter underflow: name=${name}, field=${field}, current=${String(currentValue)}, ${
          absolute ? "attemptedValue" : "delta"
        }=${String(delta)}. Clamping to 0.`
      );
    }

    await ctx.db.patch("counters", counter._id, {
      [field]: Math.max(0, newValue),
      updatedAt: Date.now(),
    });
  } else {
    const initialValue = Math.max(0, delta);
    await ctx.db.insert("counters", {
      name,
      total: field === "total" ? initialValue : 0,
      active: field === "active" ? initialValue : 0,
      pending: field === "pending" ? initialValue : 0,
      verified: field === "verified" ? initialValue : 0,
      open: field === "open" ? initialValue : 0,
      resolved: field === "resolved" ? initialValue : 0,
      draft: field === "draft" ? initialValue : 0,
      salesVolume: field === "salesVolume" ? initialValue : 0,
      soldCount: field === "soldCount" ? initialValue : 0,
      buyerTotal: field === "buyerTotal" ? initialValue : 0,
      sellerTotal: field === "sellerTotal" ? initialValue : 0,
      updatedAt: Date.now(),
    });
  }
}

/**
 * Handler for recomputing lot fee aggregate counters from scratch.
 * Paginates through the lotFees table in batches and accumulates buyer/seller totals,
 * resetting the counters to 0 on the first batch.
 * Self-reschedules until complete.
 *
 * @param ctx - The mutation context.
 * @param args - The arguments object.
 * @param args.cursor - Pagination cursor, null for first batch.
 * @param args.buyerTotal - Accumulated buyer fees total from previous batches.
 * @param args.sellerTotal - Accumulated seller fees total from previous batches.
 * @returns Object with isDone, buyerTotal, sellerTotal, and continueCursor.
 */
export async function recomputeLotFeeCountersHandler(
  ctx: MutationCtx,
  args: { cursor: string | null; buyerTotal: number; sellerTotal: number }
): Promise<{
  isDone: boolean;
  buyerTotal: number;
  sellerTotal: number;
  continueCursor: string | null;
}> {
  const {
    cursor,
    buyerTotal: incomingBuyerTotal,
    sellerTotal: incomingSellerTotal,
  } = args;

  if (cursor === null) {
    const existingCounter = await getCounter(ctx, "lotFees");
    if (existingCounter) {
      await ctx.db.patch("counters", existingCounter._id, {
        buyerTotal: 0,
        sellerTotal: 0,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("counters", {
        name: "lotFees",
        total: 0,
        active: 0,
        pending: 0,
        verified: 0,
        open: 0,
        resolved: 0,
        draft: 0,
        salesVolume: 0,
        soldCount: 0,
        buyerTotal: 0,
        sellerTotal: 0,
        updatedAt: Date.now(),
      });
    }
  }

  const BATCH_SIZE = 500;
  const page = await ctx.db
    .query("lotFees")
    .paginate({ numItems: BATCH_SIZE, cursor });

  let batchBuyerTotal = 0;
  let batchSellerTotal = 0;

  for (const feeRow of page.page) {
    if (feeRow.appliedTo === "buyer") {
      batchBuyerTotal += feeRow.calculatedAmount;
    } else {
      batchSellerTotal += feeRow.calculatedAmount;
    }
  }

  const accumulatedBuyerTotal = incomingBuyerTotal + batchBuyerTotal;
  const accumulatedSellerTotal = incomingSellerTotal + batchSellerTotal;

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.admin_utils.recomputeLotFeeCounters,
      {
        cursor: page.continueCursor,
        buyerTotal: accumulatedBuyerTotal,
        sellerTotal: accumulatedSellerTotal,
      }
    );

    return {
      isDone: false,
      buyerTotal: accumulatedBuyerTotal,
      sellerTotal: accumulatedSellerTotal,
      continueCursor: page.continueCursor,
    };
  }

  const finalCounter = await getCounter(ctx, "lotFees");
  if (finalCounter) {
    await ctx.db.patch("counters", finalCounter._id, {
      buyerTotal: accumulatedBuyerTotal,
      sellerTotal: accumulatedSellerTotal,
      updatedAt: Date.now(),
    });
  }

  return {
    isDone: true,
    buyerTotal: accumulatedBuyerTotal,
    sellerTotal: accumulatedSellerTotal,
    continueCursor: null,
  };
}

/**
 * Internal mutation to recompute lot fee aggregate counters from scratch.
 * Paginates through lotFees and rebuilds buyerTotal/sellerTotal.
 * Callable via `bunx convex run admin_utils:recomputeLotFeeCounters`.
 */
export const recomputeLotFeeCounters = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    buyerTotal: v.number(),
    sellerTotal: v.number(),
  },
  returns: v.object({
    isDone: v.boolean(),
    buyerTotal: v.number(),
    sellerTotal: v.number(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: recomputeLotFeeCountersHandler,
});
