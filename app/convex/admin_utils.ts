import type { MutationCtx, QueryCtx } from "./_generated/server";
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
  | "soldCount";

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
    const val = item[field];
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
        return (counter.total ?? 0) - (counter.verified ?? 0);
      }
    }
    return await countQuery(
      ctx.db
        .query("profiles")
        .withIndex("by_isVerified", (q) =>
          q.eq("isVerified", options.isVerified as boolean)
        )
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
        .withIndex("by_kycStatus", (q) =>
          q.eq(
            "kycStatus",
            options.kycStatus as "pending" | "verified" | "rejected"
          )
        )
    );
  }

  if (
    options.role !== undefined &&
    options.isVerified === undefined &&
    options.kycStatus === undefined
  ) {
    return await countQuery(
      ctx.db
        .query("profiles")
        .withIndex("by_role", (q) =>
          q.eq("role", options.role as "buyer" | "seller" | "admin")
        )
    );
  }

  // Complex case: Multiple filters or no index match
  // Choose the best index if possible, then filter manually for others in memory
  let results: Doc<"profiles">[];

  if (options.role !== undefined) {
    results = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) =>
        q.eq("role", options.role as "buyer" | "seller" | "admin")
      )
      .collect();
  } else if (options.kycStatus !== undefined) {
    results = await ctx.db
      .query("profiles")
      .withIndex("by_kycStatus", (q) =>
        q.eq(
          "kycStatus",
          options.kycStatus as "pending" | "verified" | "rejected"
        )
      )
      .collect();
  } else if (options.isVerified !== undefined) {
    results = await ctx.db
      .query("profiles")
      .withIndex("by_isVerified", (q) =>
        q.eq("isVerified", options.isVerified as boolean)
      )
      .collect();
  } else {
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
 * @param ctx
 * @param args
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
 * Increment or decrement a named counter's numeric field and persist the change.
 *
 * Updates the existing counter document's specified field by `delta` (clamped to a minimum of 0) and sets `updatedAt` to the current time. If no counter exists for `name` a new document is created with the targeted field initialised to `max(0, delta)` and common fields (`total`, `active`, `pending`, `verified`, `open`, `resolved`) populated (other fields set to 0). A warning is emitted to the console if the computed value would underflow below zero.
 *
 * @param ctx
 * @param name - The identifier of the counter (for example `auctions`, `profiles`, `support`, `announcements`)
 * @param field - The counter field to adjust (for example `total`, `active`, `pending`, `verified`, `open`, `resolved`)
 * @param delta - The amount to change the field by; may be negative, but the stored value will never be less than 0
 */
export async function updateCounter(
  ctx: MutationCtx,
  name: string,
  field: CounterField,
  delta: number
) {
  const counter = await getCounter(ctx, name);

  if (counter) {
    const currentValue = (counter[field] as number | undefined) ?? 0;
    const newValue = currentValue + delta;

    if (newValue < 0) {
      console.warn(
        `Counter underflow: name=${name}, field=${field}, current=${currentValue}, delta=${delta}. Clamping to 0.`
      );
    }

    await ctx.db.patch(counter._id, {
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
      updatedAt: Date.now(),
    });
  }
}
