import { v } from "convex/values";

import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getAuthUser, resolveUserId } from "./lib/auth";

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
  | "bid_won";

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
  v.literal("bid_won")
);

/**
 * Activity types that are only visible to the profile owner. KYC progress and
 * role changes are private; everyone else sees only public marketplace activity.
 */
const PRIVATE_ACTIVITY_TYPES: ReadonlySet<ActivityType> = new Set([
  "verification_requested",
  "verification_approved",
  "verification_rejected",
  "role_changed",
]);

/**
 * Default number of activity entries returned when no limit is provided.
 */
const DEFAULT_ACTIVITY_LIMIT = 10;

/**
 * Upper bound on rows scanned per query before filtering/slicing. Bounds the
 * read cost for prolific users without adding pagination (a future nice-to-have).
 */
const MAX_ACTIVITY_SCAN = 250;

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
 * KYC and role-change entries are private: they are only returned when the
 * authenticated viewer is the profile owner. Unauthenticated viewers and other
 * logged-in users see only public activity (`account_created`, `listing_created`,
 * `listing_sold`, `bid_placed`, `bid_won`).
 *
 * @param ctx - The query context.
 * @param args - The query arguments.
 * @param args.userId - The profile owner's user ID.
 * @param args.limit - Maximum number of entries to return (default 10).
 * @returns The filtered, truncated list of activity entries.
 */
export const getSellerActivityHandler = async (
  ctx: QueryCtx,
  args: { userId: string; limit?: number }
) => {
  const limit = args.limit ?? DEFAULT_ACTIVITY_LIMIT;

  const authUser = await getAuthUser(ctx);
  const viewerId = authUser ? resolveUserId(authUser) : null;
  const viewerIsOwner = viewerId !== null && viewerId === args.userId;

  const rows = await ctx.db
    .query("userActivity")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
    .order("desc")
    .take(viewerIsOwner ? limit : MAX_ACTIVITY_SCAN);

  const visible = viewerIsOwner
    ? rows
    : rows.filter((row) => !PRIVATE_ACTIVITY_TYPES.has(row.type));

  return visible.slice(0, limit).map((row) => ({
    _id: row._id,
    _creationTime: row._creationTime,
    type: row.type,
    description: row.description,
    relatedId: row.relatedId,
    createdAt: row.createdAt,
  }));
};

/**
 * Fetch a user's recent activity feed entries, most recent first. Private
 * KYC/role entries are only included for the profile owner (computed
 * server-side from the authenticated caller).
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
