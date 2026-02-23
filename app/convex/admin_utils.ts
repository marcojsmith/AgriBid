import type { MutationCtx } from "./_generated/server";
import { getAuthUser } from "./lib/auth";
import { encryptPII, decryptPII } from "./lib/encryption";

/**
 * Record an audit log entry for the current authenticated admin.
 *
 * If there is no authenticated user identity, the function throws to prevent unaudited admin actions.
 *
 * `@param` args.action - Short identifier of the action performed (e.g., "delete_user", "update_settings")
 * @param args.targetId - Optional identifier of the target resource affected by the action
 * @param args.targetType - Optional type/category of the target resource (e.g., "user", "project")
 * @param args.details - Optional free-form details about the action or context
 * @param args.targetCount - Optional number of targets affected by the action
 */
export async function logAudit(
  ctx: MutationCtx,
  args: {
    action: string;
    targetId?: string;
    targetType?: string;
    details?: string;
    targetCount?: number;
  },
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
export { encryptPII, decryptPII }

/**
 * Transactionally increments or decrements a specific field in a counter document.
 * 
 * @param ctx - The mutation context
 * @param name - The name of the counter (e.g., "auctions", "profiles")
 * @param field - The field to update (e.g., "total", "active", "pending", "verified")
 * @param delta - The amount to change by (e.g., 1 or -1)
 */
export async function updateCounter(
  ctx: MutationCtx,
  name: string,
  field: "total" | "active" | "pending" | "verified",
  delta: number,
) {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();

  if (counter) {
    const currentValue = (counter[field] as number | undefined) ?? 0;
    const newValue = currentValue + delta;

    if (newValue < 0) {
      console.warn(
        `Counter underflow detected: counter=${counter._id}, name=${name}, field=${field}, currentValue=${currentValue}, delta=${delta}. Clamping to 0.`,
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
      updatedAt: Date.now(),
    });
  }
}
