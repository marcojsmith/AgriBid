import { v, ConvexError } from "convex/values";

import {
  mutation,
  query,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { getAuthUser, requireAuth, resolveUserId } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Augments a list of announcement notifications with a per-user `isRead` flag.
 *
 * @param ctx - Convex Query context used to access the database for read receipts
 * @param userId - ID of the user whose read status will be applied
 * @param announcements - Announcement notification documents to enrich
 * @returns The provided announcements where each item includes `isRead`: `true` if the user has a read receipt for that notification, `false` otherwise
 */
async function getAnnouncementsWithReadStatus(
  ctx: QueryCtx,
  userId: string,
  announcements: Doc<"notifications">[]
) {
  if (announcements.length === 0) return [];

  // Fetch read receipts only for the provided announcements to keep it bounded
  const readReceipts = await Promise.all(
    announcements.map((a) =>
      ctx.db
        .query("readReceipts")
        .withIndex("by_user_notification", (q) =>
          q.eq("userId", userId).eq("notificationId", a._id)
        )
        .unique()
    )
  );

  const readNotificationIds = new Set(
    readReceipts
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => r.notificationId)
  );

  return announcements.map((a) => ({
    ...a,
    isRead: readNotificationIds.has(a._id),
  }));
}

const notificationType = v.union(
  v.literal("info"),
  v.literal("success"),
  v.literal("warning"),
  v.literal("error")
);

/**
 * Handler for getting the current user's notifications.
 * @param ctx
 * @returns Promise<Notification[]>
 */
export const getMyNotificationsHandler = async (ctx: QueryCtx) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return [];
    const userId = authUser.userId ?? authUser._id;

    // Fetch personal notifications
    const personal = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_createdAt", (q) => q.eq("recipientId", userId))
      .order("desc")
      .take(20);

    // Fetch global announcements
    const announcements = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_createdAt", (q) => q.eq("recipientId", "all"))
      .order("desc")
      .take(10);

    const enrichedAnnouncements = await getAnnouncementsWithReadStatus(
      ctx,
      userId,
      announcements
    );

    // Merge and sort, applying read status for announcements
    const merged = [...personal, ...enrichedAnnouncements];

    return merged.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
      console.error("getMyNotifications failure:", err);
    }
    return [];
  }
};

export const getMyNotifications = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      _creationTime: v.number(),
      recipientId: v.string(),
      type: notificationType,
      title: v.string(),
      message: v.string(),
      isRead: v.boolean(),
      createdAt: v.number(),
      link: v.optional(v.string()),
    })
  ),
  handler: getMyNotificationsHandler,
});

/**
 * Handler for getting the notification archive.
 * @param ctx
 * @param args
 * @param args.limit
 * @returns Promise<Notification[]>
 */
export const getNotificationArchiveHandler = async (
  ctx: QueryCtx,
  args: { limit?: number }
) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return [];
    const userId = authUser.userId ?? authUser._id;

    // Normalize and cap limit: default to 50, max 100
    const MAX_LIMIT = 100;
    const cappedLimit = Math.min(MAX_LIMIT, Math.max(0, args.limit ?? 50));

    const personal = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_createdAt", (q) => q.eq("recipientId", userId))
      .order("desc")
      .take(cappedLimit);

    const announcements = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_createdAt", (q) => q.eq("recipientId", "all"))
      .order("desc")
      .take(cappedLimit);

    const enrichedAnnouncements = await getAnnouncementsWithReadStatus(
      ctx,
      userId,
      announcements
    );

    const merged = [...personal, ...enrichedAnnouncements];

    return merged
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, cappedLimit);
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
      console.error("getNotificationArchive failure:", err);
    }
    return [];
  }
};

export const getNotificationArchive = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("notifications"),
      _creationTime: v.number(),
      recipientId: v.string(),
      type: notificationType,
      title: v.string(),
      message: v.string(),
      isRead: v.boolean(),
      createdAt: v.number(),
      link: v.optional(v.string()),
    })
  ),
  handler: getNotificationArchiveHandler,
});

/**
 * Handler for marking a notification as read.
 * @param ctx
 * @param args
 * @param args.notificationId
 * @returns Promise<null>
 */
export const markAsReadHandler = async (
  ctx: MutationCtx,
  args: { notificationId: Id<"notifications"> }
) => {
  const authUser = await requireAuth(ctx);
  const userId = resolveUserId(authUser);
  if (!userId) throw new Error("Unable to determine user ID");

  const notification = await ctx.db.get(args.notificationId);
  if (!notification) throw new ConvexError("Notification not found");

  if (notification.recipientId === "all") {
    // For broadcast, insert a read receipt if it doesn't exist
    const existing = await ctx.db
      .query("readReceipts")
      .withIndex("by_user_notification", (q) =>
        q.eq("userId", userId).eq("notificationId", args.notificationId)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("readReceipts", {
        userId,
        notificationId: args.notificationId,
        readAt: Date.now(),
      });
    }
  } else {
    if (notification.recipientId !== userId) {
      throw new ConvexError(
        "Unauthorized: This notification does not belong to you"
      );
    }
    await ctx.db.patch(args.notificationId, { isRead: true });
  }

  return null;
};

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: markAsReadHandler,
});

/**
 * Handler for marking all notifications as read.
 * @param ctx
 * @returns Promise<null>
 */
export const markAllReadHandler = async (ctx: MutationCtx) => {
  const authUser = await requireAuth(ctx);
  const userId = resolveUserId(authUser);
  if (!userId) throw new Error("Unable to determine user ID");

  // Helper for chunking arrays
  const chunk = <T>(arr: T[], size: number): T[][] => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const BATCH_SIZE = 50;

  // Mark personal notifications as read in batches
  const unreadPersonal = await ctx.db
    .query("notifications")
    .withIndex("by_recipient", (q) =>
      q.eq("recipientId", userId).eq("isRead", false)
    )
    .take(500); // Safety cap for total processed

  const personalChunks = chunk(unreadPersonal, BATCH_SIZE);
  for (const batch of personalChunks) {
    await Promise.all(
      batch.map((notification: Doc<"notifications">) =>
        ctx.db.patch(notification._id, { isRead: true })
      )
    );
  }

  // Mark all currently visible announcements as read via receipts in batches
  const announcements = await ctx.db
    .query("notifications")
    .withIndex("by_recipient_createdAt", (q) => q.eq("recipientId", "all"))
    .order("desc")
    .take(100); // Only process latest 100 announcements

  if (announcements.length > 0) {
    // Fetch read receipts only for these specific announcements
    const existingReceipts = await Promise.all(
      announcements.map((a: Doc<"notifications">) =>
        ctx.db
          .query("readReceipts")
          .withIndex("by_user_notification", (q) =>
            q.eq("userId", userId).eq("notificationId", a._id)
          )
          .unique()
      )
    );

    const existingNotificationIds = new Set(
      existingReceipts
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .map((r) => r.notificationId)
    );
    const now = Date.now();

    const newReceipts = announcements.filter(
      (announcement: Doc<"notifications">) =>
        !existingNotificationIds.has(announcement._id)
    );

    const receiptChunks = chunk(newReceipts, BATCH_SIZE);
    for (const batch of receiptChunks) {
      await Promise.all(
        batch.map((announcement: Doc<"notifications">) =>
          ctx.db.insert("readReceipts", {
            userId,
            notificationId: announcement._id,
            readAt: now,
          })
        )
      );
    }
  }

  return null;
};

export const markAllRead = mutation({
  args: {},
  returns: v.null(),
  handler: markAllReadHandler,
});
