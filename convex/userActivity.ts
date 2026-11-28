import { v } from "convex/values";

import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getViewer } from "./lib/viewer";

/**
 * Activity types recorded in the `userActivity` table. Keep in sync with the
 * `userActivity.type` validator in `convex/schema.ts`.
 */
export type ActivityType =
  | "account_created"
  | "verification_requested"
  | "verification_approved"
  | "verification_rejected"
  | "role_changed"
  | "listing_created"
  | "listing_sold"
  | "bid_placed"
  | "bid_won"
  | "payment_claimed";

/**
 * Validator for `ActivityType`, matching the `userActivity.type` schema field.
 */
export const ActivityTypeValidator = v.union(
  v.literal("account_created"),
  v.literal("verification_requested"),
  v.literal("verification_approved"),
  v.literal("verification_rejected"),
  v.literal("role_changed"),
  v.literal("listing_created"),
  v.literal("listing_sold"),
  v.literal("bid_placed"),
  v.literal("bid_won"),
  v.literal("payment_claimed")
);

/**
 * Default number of activity entries returned when no limit is provided.
 */
const DEFAULT_ACTIVITY_LIMIT = 10;

/**
 * Insert a user activity feed entry. Must be called from within the same
 * mutation transaction as the event it records (same convention as `logAudit`
 * in `convex/admin_utils.ts`) — not via `ctx.runMutation` — so the entry is
 * written atomically with the change it describes.
 *
 * @param ctx - The mutation context of the calling mutation.
 * @param args - The activity entry to record.
 * @param args.userId - The user the activity belongs to.
 * @param args.type - One of the {@link ActivityType} literals.
 * @param args.description - Optional short, human-readable event description.
 * @param args.relatedId - Optional ID of the related resource (e.g. auctionId).
 */
export async function logActivity(
  ctx: MutationCtx,
  args: {
    userId: string;
    type: ActivityType;
    description?: string;
    relatedId?: string;
  }
): Promise<void> {
  await ctx.db.insert("userActivity", { ...args, createdAt: Date.now() });
}

/**
 * Handler for fetching a user's recent activity feed entries, most recent first.
 *
 * The feed holds bids, wins, KYC progress and role changes, so it is private:
 * only the user themselves and admins get entries. Everyone else, signed in or
 * not, gets an empty list.
 *
 * @param ctx - The query context.
 * @param args - The query arguments.
 * @param args.userId - The profile owner's user ID.
 * @param args.limit - Maximum number of entries to return (default 10).
 * @returns The activity entries, or an empty list for anyone but the owner or an admin.
 */
export const getSellerActivityHandler = async (
  ctx: QueryCtx,
  args: { userId: string; limit?: number }
) => {
  const limit = args.limit ?? DEFAULT_ACTIVITY_LIMIT;

  // Bid and win activity is private: only the user and admins see any of it.
  const viewer = await getViewer(ctx);
  const viewerIsOwner = viewer.userId !== null && viewer.userId === args.userId;
  if (!viewerIsOwner && !viewer.isAdmin) return [];

  const rows = await ctx.db
    .query("userActivity")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
    .order("desc")
    .take(limit);

  return rows.map((row) => ({
    _id: row._id,
    _creationTime: row._creationTime,
    type: row.type,
    description: row.description,
    relatedId: row.relatedId,
    createdAt: row.createdAt,
  }));
};

/**
 * Fetch a user's recent activity feed entries, most recent first. Returns an
 * empty list unless the caller is that user or an admin (computed server-side
 * from the authenticated caller).
 */
export const getSellerActivity = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("userActivity"),
      _creationTime: v.number(),
      type: ActivityTypeValidator,
      description: v.optional(v.string()),
      relatedId: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: getSellerActivityHandler,
});
