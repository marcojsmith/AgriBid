import type { MutationCtx } from "./_generated/server";
import { getAuthUser } from "./lib/auth";
import { encryptPII, decryptPII } from "./lib/encryption";

/**
 * Create an audit log entry for the currently authenticated admin.
 *
 * Throws an Error if no authenticated user identity is present.
 *
 * @param args.action - Short identifier of the action performed (for example `delete_user` or `update_settings`)
 * @param args.targetId - Optional identifier of the resource affected by the action
 * @param args.targetType - Optional type or category of the resource (for example `user` or `project`)
 * @param args.details - Optional free-form details or context about the action
 * @param args.targetCount - Optional number of targets affected by the action
 * @throws Error When there is no authenticated user available in the provided context
 */
export async function logAudit(
  ctx: MutationCtx,
  args: {
    action: string;
    targetId?: string;
    targetType?: string;
    details?: string;
    targetCount?: number;
  }
) {
  const authUser = await getAuthUser(ctx);
  if (!authUser) {
    const errorContext = `Audit Log Failure: Missing identity for action ${args.action} on ${args.targetType}:${args.targetId}`;
    console.error(errorContext);
    throw new Error(errorContext);
  }

  await ctx.db.insert("auditLogs", {
    adminId: authUser.userId ?? authUser._id,
    action: args.action,
    targetId: args.targetId,
    targetType: args.targetType,
    details: args.details,
    targetCount: args.targetCount,
    timestamp: Date.now(),
  });
}

// Re-export encryption functions from lib/encryption for backward compatibility
export { encryptPII, decryptPII };

/**
 * Increment or decrement a named counter's numeric field and persist the change.
 *
 * Updates the existing counter document's specified field by `delta` (clamped to a minimum of 0) and sets `updatedAt` to the current time. If no counter exists for `name` a new document is created with the targeted field initialised to `max(0, delta)` and common fields (`total`, `active`, `pending`, `verified`, `open`, `resolved`) populated (other fields set to 0). A warning is emitted to the console if the computed value would underflow below zero.
 *
 * @param name - The identifier of the counter (for example `auctions`, `profiles`, `support`, `announcements`)
 * @param field - The counter field to adjust (for example `total`, `active`, `pending`, `verified`, `open`, `resolved`)
 * @param delta - The amount to change the field by; may be negative, but the stored value will never be less than 0
 */
export async function updateCounter(
  ctx: MutationCtx,
  name: string,
  field: string,
  delta: number
) {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();

  if (counter) {
    const currentValue =
      (counter[field as keyof typeof counter] as number | undefined) ?? 0;
    const newValue = currentValue + delta;

    if (newValue < 0) {
      console.warn(
        `Counter underflow detected: counter=${counter._id}, name=${name}, field=${field}, currentValue=${currentValue}, delta=${delta}. Clamping to 0.`
      );
    }

    await ctx.db.patch(counter._id, {
      [field]: Math.max(0, newValue),
      updatedAt: Date.now(),
    });
  } else {
    // Initialize if it doesn't exist
    const initialValue = Math.max(0, delta);
    await ctx.db.insert("counters", {
      name,
      total: field === "total" ? initialValue : 0,
      active: field === "active" ? initialValue : 0,
      pending: field === "pending" ? initialValue : 0,
      verified: field === "verified" ? initialValue : 0,
      open: field === "open" ? initialValue : 0,
      resolved: field === "resolved" ? initialValue : 0,
      updatedAt: Date.now(),
    });
  }
}
