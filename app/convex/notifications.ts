import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import type { Doc } from "./_generated/dataModel";

/**
 * Shared helper to merge announcements with their read status for a specific user.
 */
async function getAnnouncementsWithReadStatus(
  ctx: QueryCtx,
  userId: string,
  announcements: Doc<"notifications">[],
) {
  if (announcements.length === 0) return [];

  // Fetch read receipts only for the provided announcements to keep it bounded
  const readReceipts = await Promise.all(
    announcements.map((a) =>
      ctx.db
        .query("readReceipts")
        .withIndex("by_user_notification", (q) =>
          q.eq("userId", userId).eq("notificationId", a._id),
        )
        .unique(),
    ),
  );

  const readNotificationIds = new Set(
    readReceipts
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((r) => r.notificationId),
  );

  return announcements.map((a) => ({
    ...a,
    isRead: readNotificationIds.has(a._id),
  }));
}

export const getMyNotifications = query({
  args: {},
  handler: async (ctx) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
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
        announcements,
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
  },
});

export const getNotificationArchive = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (!authUser) return [];
      const userId = authUser.userId ?? authUser._id;

      const personal = await ctx.db
        .query("notifications")
        .withIndex("by_recipient_createdAt", (q) => q.eq("recipientId", userId))
        .order("desc")
        .take(args.limit || 100);

      const announcements = await ctx.db
        .query("notifications")
        .withIndex("by_recipient_createdAt", (q) => q.eq("recipientId", "all"))
        .order("desc")
        .take(args.limit || 50);

      const enrichedAnnouncements = await getAnnouncementsWithReadStatus(
        ctx,
        userId,
        announcements,
      );

      const merged = [...personal, ...enrichedAnnouncements];

      return merged.sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes("Unauthenticated"))) {
        console.error("getNotificationArchive failure:", err);
      }
      return [];
    }
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const userId = authUser.userId ?? authUser._id;

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");

    if (notification.recipientId === "all") {
      // For broadcast, insert a read receipt if it doesn't exist
      const existing = await ctx.db
        .query("readReceipts")
        .withIndex("by_user_notification", (q) =>
          q.eq("userId", userId).eq("notificationId", args.notificationId),
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
        throw new Error(
          "Unauthorized: This notification does not belong to you",
        );
      }
      await ctx.db.patch(args.notificationId, { isRead: true });
    }
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const userId = authUser.userId ?? authUser._id;

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
        q.eq("recipientId", userId).eq("isRead", false),
      )
      .take(500); // Safety cap for total processed

    const personalChunks = chunk(unreadPersonal, BATCH_SIZE);
    for (const batch of personalChunks) {
      await Promise.all(
        batch.map((notification) =>
          ctx.db.patch(notification._id, { isRead: true }),
        ),
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
        announcements.map((a) =>
          ctx.db
            .query("readReceipts")
            .withIndex("by_user_notification", (q) =>
              q.eq("userId", userId).eq("notificationId", a._id),
            )
            .unique(),
        ),
      );

      const existingNotificationIds = new Set(
        existingReceipts.filter((r) => r !== null).map((r) => r!.notificationId),
      );
      const now = Date.now();

      const newReceipts = announcements.filter(
        (announcement) => !existingNotificationIds.has(announcement._id),
      );

      const receiptChunks = chunk(newReceipts, BATCH_SIZE);
      for (const batch of receiptChunks) {
        await Promise.all(
          batch.map((announcement) =>
            ctx.db.insert("readReceipts", {
              userId,
              notificationId: announcement._id,
              readAt: now,
            }),
          ),
        );
      }
    }
  },
});
