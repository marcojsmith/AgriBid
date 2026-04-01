import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import {
  mutation,
  query,
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import { getAuthUser, requireAuth, resolveUserId } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Fetches read receipt counts for multiple notifications in parallel using indexed queries.
 *
 * In Convex, each indexed query is a distinct DB operation. This helper consolidates
 * the parallel Promise.all pattern into a single, reusable function with O(1) Map lookup
 * for callers. This is the recommended pattern for Convex -- there is no native "batch
 * get by multiple IDs" operation.
 *
 * @param ctx - Convex Query context used to access the database
 * @param notificationIds - Array of notification IDs to fetch read counts for
 * @returns Map of notification ID to read receipt count
 */
export async function batchFetchReadCounts(
  ctx: QueryCtx,
  notificationIds: Id<"notifications">[]
): Promise<Map<Id<"notifications">, number>> {
  if (notificationIds.length === 0) return new Map();

  const counts = await Promise.all(
    notificationIds.map((id) =>
      ctx.db
        .query("readReceipts")
        .withIndex("by_notification", (q) => q.eq("notificationId", id))
        .collect()
        .then((r) => r.length)
    )
  );

  const result = new Map<Id<"notifications">, number>();
  notificationIds.forEach((id, i) => {
    result.set(id, counts[i] as number);
  });
  return result;
}

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

  const announcementIds = announcements.map((a) => a._id);

  const userReceipts = await ctx.db
    .query("readReceipts")
    .withIndex("by_user_notification", (q) => q.eq("userId", userId))
    .collect();

  const readNotificationIds = new Set(
    userReceipts
      .filter((r) => announcementIds.includes(r.notificationId))
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
 * Handler for getting the current user's notifications with pagination.
 * @param ctx - Query context
 * @param args - Arguments including pagination options
 * @param args.paginationOpts - Pagination options for cursor-based pagination
 * @param args.paginationOpts.numItems - Number of items per page
 * @param args.paginationOpts.cursor - Cursor for the next page
 * @returns Paginated result with notifications page and pagination metadata
 */
export const getMyNotificationsHandler = async (
  ctx: QueryCtx,
  args: { paginationOpts?: { numItems: number; cursor?: string | null } }
) => {
  try {
    const authUser = await getAuthUser(ctx);
    if (!authUser) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
        totalCount: 0,
        pageStatus: null,
        splitCursor: null,
      };
    }
    const userId = authUser.userId ?? authUser._id;

    const [personal, announcementsResult] = await Promise.all([
      ctx.db
        .query("notifications")
        .withIndex("by_recipient_createdAt", (q) => q.eq("recipientId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("notifications")
        .withIndex("by_recipient_createdAt", (q) => q.eq("recipientId", "all"))
        .order("desc")
        .collect(),
    ]);

    const enrichedAnnouncements = await getAnnouncementsWithReadStatus(
      ctx,
      userId,
      announcementsResult
    );

    const merged = [...personal, ...enrichedAnnouncements];
    const sorted = merged.sort((a, b) => b.createdAt - a.createdAt);

    const numItems = args.paginationOpts?.numItems ?? 20;
    const cursor = args.paginationOpts?.cursor ?? null;

    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const page = sorted.slice(startIndex, startIndex + numItems);
    const isDone = startIndex + numItems >= sorted.length;
    const continueCursor = isDone ? "" : String(startIndex + numItems);
    const totalCount = sorted.length;

    return {
      page,
      isDone,
      continueCursor,
      totalCount,
      pageStatus: null,
      splitCursor: null,
    };
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
      console.error("getMyNotifications failure:", err);
    }
    return {
      page: [],
      isDone: true,
      continueCursor: "",
      totalCount: 0,
      pageStatus: null,
      splitCursor: null,
    };
  }
};

export const getMyNotifications = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(
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
    isDone: v.boolean(),
    continueCursor: v.string(),
    totalCount: v.number(),
    pageStatus: v.null(),
    splitCursor: v.null(),
  }),
  handler: getMyNotificationsHandler,
});

/**
 * Handler for getting the notification archive.
 * @param ctx - Query context
 * @param args - Arguments including optional limit
 * @param args.limit - Maximum number of notifications to return (capped at 100)
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
 * @param ctx - Mutation context
 * @param args - Arguments including the notification ID
 * @param args.notificationId - The ID of the notification to mark as read
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
 * @param ctx - Mutation context
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
    const announcementIds = announcements.map((a) => a._id);

    const userReceipts = await ctx.db
      .query("readReceipts")
      .withIndex("by_user_notification", (q) => q.eq("userId", userId))
      .collect();

    const existingNotificationIds = new Set(
      userReceipts
        .filter((r) => announcementIds.includes(r.notificationId))
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

/**
 * Gets the count of unread notifications for the current user.
 * Includes both personal notifications and broadcast announcements
 * without a read receipt.
 *
 * @param ctx - Query context
 * @returns The number of unread notifications
 */
export const getUnreadCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const authUser = await getAuthUser(ctx);
    if (!authUser) return 0;
    const userId = resolveUserId(authUser);
    if (!userId) return 0;

    // Count unread personal notifications
    const personalUnread = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_isRead_createdAt", (q) =>
        q.eq("recipientId", userId).eq("isRead", false)
      )
      .collect();

    // Count broadcast announcements without a read receipt from this user
    const announcements = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_isRead_createdAt", (q) =>
        q.eq("recipientId", "all").eq("isRead", false)
      )
      .collect();

    let unreadAnnouncements = 0;
    for (const ann of announcements) {
      const receipt = await ctx.db
        .query("readReceipts")
        .withIndex("by_user_notification", (q) =>
          q.eq("userId", userId).eq("notificationId", ann._id)
        )
        .unique();
      if (!receipt) unreadAnnouncements++;
    }

    return personalUnread.length + unreadAnnouncements;
  },
});

/**
 * Internal mutation to create a notification.
 *
 * @param ctx - Mutation context
 * @param args - Notification details
 * @returns The ID of the created notification
 */
export const createNotification = internalMutation({
  args: {
    recipientId: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error")
    ),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      recipientId: args.recipientId,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

/**
 * Notifies a user via in-app notification and optionally sends a push
 * notification if the user has push enabled for the event type.
 *
 * This is the preferred function for creating notifications, as it
 * respects user channel preferences and handles push delivery.
 *
 * @param ctx - Mutation context
 * @param args - Notification details with optional event type
 * @returns The ID of the created notification
 */
export const notifyUser = internalMutation({
  args: {
    recipientId: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("success"),
      v.literal("warning"),
      v.literal("error")
    ),
    title: v.string(),
    message: v.string(),
    link: v.optional(v.string()),
    event: v.optional(
      v.union(
        v.literal("outbid"),
        v.literal("auctionWon"),
        v.literal("auctionLost"),
        v.literal("reserveNotMet"),
        v.literal("watchlistEnding"),
        v.literal("listingApproved")
      )
    ),
  },
  returns: v.id("notifications"),
  handler: async (ctx, args) => {
    const notificationId = await ctx.db.insert("notifications", {
      recipientId: args.recipientId,
      type: args.type,
      title: args.title,
      message: args.message,
      link: args.link,
      isRead: false,
      createdAt: Date.now(),
    });

    // Send push notification if event type is specified
    if (args.event) {
      try {
        const pref = await ctx.runQuery(
          internal.pushQueries.getNotificationPreference,
          {
            userId: args.recipientId,
            eventType: args.event,
          }
        );

        if (pref.push) {
          await ctx.scheduler.runAfter(0, internal.pushActions.sendPushToUser, {
            userId: args.recipientId,
            title: args.title,
            body: args.message,
            url: args.link,
          });
        }
      } catch (err) {
        console.error("Failed to schedule push notification:", err);
      }
    }

    return notificationId;
  },
});
