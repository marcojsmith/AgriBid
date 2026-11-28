import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

/** Push subscriptions read per user, to bound a single call. */
const SUBSCRIPTIONS_PER_USER = 10;

/** What a push shows and where tapping it goes. */
export interface PushPayload {
  title: string;
  body: string;
  /** In-app path the notification opens. */
  url: string;
  /** Replaces an earlier notification with the same tag. */
  tag: string;
}

/** The user-controlled push switches (all default on when unset). */
export type PushSwitch =
  | "notificationsWatchedLots"
  | "notificationsLotsWon"
  | "notificationsSalesOpening";

/**
 * Whether a user's push switch allows a push. A missing preferences row or an
 * unset switch means on; only an explicit `false` blocks.
 *
 * @param ctx - Mutation context
 * @param userId - The recipient
 * @param key - Which of the three switches
 * @returns True when the push may be sent
 */
export async function pushSwitchAllows(
  ctx: MutationCtx,
  userId: string,
  key: PushSwitch
): Promise<boolean> {
  const prefs = await ctx.db
    .query("userPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  return prefs?.[key] !== false;
}

/**
 * Schedules a web push to every stored subscription of one user (the in-app
 * notification is written separately by the caller). Nothing is scheduled when
 * the user has no subscription; the sender itself skips delivery when VAPID is
 * not configured, like every other push in the app.
 *
 * @param ctx - Mutation context
 * @param userId - The recipient
 * @param payload - What to show
 * @returns How many subscriptions the push was queued for
 */
export async function pushToUser(
  ctx: MutationCtx,
  userId: string,
  payload: PushPayload
): Promise<number> {
  const subscriptions = await ctx.db
    .query("pushSubscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(SUBSCRIPTIONS_PER_USER);
  if (subscriptions.length === 0) return 0;
  const json = JSON.stringify(payload);
  await ctx.scheduler.runAfter(0, internal.pushNode.sendPushBatch, {
    messages: subscriptions.map((s) => ({
      endpoint: s.endpoint,
      p256dh: s.p256dh,
      auth: s.auth,
      payload: json,
    })),
  });
  return subscriptions.length;
}

/**
 * Pushes a "lots you win" notice (win, payment confirmed, pay-by reminder)
 * unless the user switched "Lots you win" off.
 *
 * @param ctx - Mutation context
 * @param userId - The recipient
 * @param payload - What to show
 * @returns How many subscriptions the push was queued for
 */
export async function pushLotsWon(
  ctx: MutationCtx,
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!(await pushSwitchAllows(ctx, userId, "notificationsLotsWon"))) return 0;
  return await pushToUser(ctx, userId, payload);
}
