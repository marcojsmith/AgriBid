import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isWatchAlertsEnabled } from "./admin/platformSettings";
import { notifyUser } from "./auctions/internal";
import {
  CLOSING_SOON_MAX_NOTIFICATIONS,
  CLOSING_SOON_WINDOW_MS,
} from "./constants";
import type { PushMessage } from "./lib/pushDelivery";

/** Push subscriptions read per user, to bound a single run. */
const SUBSCRIPTIONS_PER_USER = 10;
/** South Africa Standard Time is UTC+2 all year (no daylight saving). */
const SAST_OFFSET_MS = 2 * 3_600_000;
const NBSP = " ";

/**
 * Formats a rand amount for a push body, e.g. `R 450 000`, using a no-break
 * space between the currency sign and every thousands group so the amount
 * never wraps. Convex code cannot import `src/lib`, so this mirrors it.
 *
 * @param amount - Whole rand amount
 * @returns The formatted amount
 */
export function formatRandPush(amount: number): string {
  const digits = String(Math.round(amount));
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return `R${NBSP}${groups.join(NBSP)}`;
}

/**
 * Formats a timestamp as `HH:mm` in South African time.
 *
 * @param ms - Epoch milliseconds
 * @returns The 24-hour time, zero-padded
 */
export function formatSastTime(ms: number): string {
  const d = new Date(ms + SAST_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** One alert: the in-app notification and the push payload share it. */
interface Alert {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/**
 * Writes the in-app notification and returns the push messages for one user's
 * subscriptions (the caller batches and schedules them).
 *
 * @param ctx - Mutation context
 * @param userId - The recipient
 * @param alert - What to say
 * @returns One push message per stored subscription
 */
async function alertUser(
  ctx: MutationCtx,
  userId: string,
  alert: Alert
): Promise<PushMessage[]> {
  await notifyUser(ctx, {
    recipientId: userId,
    type: "info",
    title: alert.title,
    message: alert.body,
    link: alert.url,
  });
  const payload = JSON.stringify(alert);
  const subscriptions = await ctx.db
    .query("pushSubscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(SUBSCRIPTIONS_PER_USER);
  return subscriptions.map((s) => ({
    endpoint: s.endpoint,
    p256dh: s.p256dh,
    auth: s.auth,
    payload,
  }));
}

/**
 * Tells the previous leader they were outbid, when the leader changed, the
 * previous leader is not the bidder, they also watch the lot and the setting
 * is on. Creates the in-app notification and schedules the push.
 *
 * @param ctx - Mutation context
 * @param args - The lot, the leaders before and after the bid and the new price
 * @param args.lot - The lot that was bid on
 * @param args.previousLeaderId - Leader before the bid (undefined on a first bid)
 * @param args.newLeaderId - Leader after the bid, including any proxy counter-bid
 * @param args.bidderId - The caller who placed the bid
 * @param args.amount - The leading amount after the bid
 */
export async function notifyOutbidWatcher(
  ctx: MutationCtx,
  args: {
    lot: Doc<"lots">;
    previousLeaderId: string | undefined;
    newLeaderId: string | undefined;
    bidderId: string;
    amount: number;
  }
): Promise<void> {
  const { lot, previousLeaderId } = args;
  if (
    previousLeaderId === undefined ||
    previousLeaderId === args.bidderId ||
    previousLeaderId === args.newLeaderId
  ) {
    return;
  }
  if (!(await isWatchAlertsEnabled(ctx))) return;
  const watching = await ctx.db
    .query("watchlist")
    .withIndex("by_user_lot", (q) =>
      q.eq("userId", previousLeaderId).eq("lotId", lot._id)
    )
    .first();
  if (!watching) return;
  const messages = await alertUser(ctx, previousLeaderId, {
    title: "You've been outbid",
    body: `${lot.title}: the bid is now ${formatRandPush(args.amount)}. Tap to bid again.`,
    url: `/auction/${lot._id}`,
    tag: `outbid-${lot._id}`,
  });
  if (messages.length > 0) {
    await ctx.scheduler.runAfter(0, internal.pushNode.sendPushBatch, {
      messages,
    });
  }
}

/**
 * Sends the "closing in 1 hour" alert to every watcher of the open lots of
 * published sales ending within the hour, once per lot (`closingSoonNotifiedAt`).
 * Bounded to {@link CLOSING_SOON_MAX_NOTIFICATIONS} watcher notifications per
 * run: a lot is only started when its watchers fit what is left of the budget
 * (a single lot with more watchers than the whole budget notifies its first
 * {@link CLOSING_SOON_MAX_NOTIFICATIONS}), and `hasMore` tells the gated cron
 * wrapper to reschedule.
 *
 * @param ctx - Mutation context
 * @param now - Current time (ms)
 * @returns How many watchers were notified and whether more may remain
 */
export async function sendClosingSoonAlertsHandler(
  ctx: MutationCtx,
  now: number
): Promise<{ notified: number; hasMore: boolean }> {
  if (!(await isWatchAlertsEnabled(ctx)))
    return { notified: 0, hasMore: false };

  let notified = 0;
  let hasMore = false;
  const messages: PushMessage[] = [];

  const sales = ctx.db.query("auctions").withIndex("by_status_endTime", (q) =>
    q
      .eq("status", "published")
      .gt("endTime", now)
      .lte("endTime", now + CLOSING_SOON_WINDOW_MS)
  );
  sales: for await (const sale of sales) {
    const lots = ctx.db
      .query("lots")
      .withIndex("by_status_auctionId", (q) =>
        q.eq("status", "assigned").eq("auctionId", sale._id)
      );
    for await (const lot of lots) {
      if (lot.closingSoonNotifiedAt !== undefined) continue;
      const watchers = await ctx.db
        .query("watchlist")
        .withIndex("by_lot", (q) => q.eq("lotId", lot._id))
        .take(CLOSING_SOON_MAX_NOTIFICATIONS);
      if (
        notified > 0 &&
        notified + watchers.length > CLOSING_SOON_MAX_NOTIFICATIONS
      ) {
        hasMore = true;
        break sales;
      }
      const closesAt = formatSastTime(lot.extendedEndTime ?? sale.endTime);
      for (const watcher of watchers) {
        messages.push(
          ...(await alertUser(ctx, watcher.userId, {
            title: "Closing in 1 hour",
            body: `${lot.title} closes at ${closesAt}. Tap to see the lot.`,
            url: `/auction/${lot._id}`,
            tag: `closing-${lot._id}`,
          }))
        );
      }
      notified += watchers.length;
      await ctx.db.patch("lots", lot._id, { closingSoonNotifiedAt: now });
    }
  }

  if (messages.length > 0) {
    await ctx.scheduler.runAfter(0, internal.pushNode.sendPushBatch, {
      messages,
    });
  }
  return { notified, hasMore };
}
