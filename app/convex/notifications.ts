import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getMyNotifications = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    // Fetch personal notifications
    const personal = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .order("desc")
      .take(20);

    // Fetch global announcements
    const announcements = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", "all"))
      .order("desc")
      .take(10);

    // Fetch read receipts only for the fetched announcements to keep it bounded
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
      readReceipts.filter((r) => r !== null).map((r) => r!.notificationId),
    );

    // Merge and sort, applying read status for announcements
    const merged = [
      ...personal,
      ...announcements.map((a) => ({
        ...a,
        isRead: readNotificationIds.has(a._id),
      })),
    ];

    return merged.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  },
});

export const getNotificationArchive = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;

    const personal = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", userId))
      .order("desc")
      .take(args.limit || 100);

    const announcements = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", "all"))
      .order("desc")
      .take(args.limit || 50);

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
      readReceipts.filter((r) => r !== null).map((r) => r!.notificationId),
    );

    const merged = [
      ...personal,
      ...announcements.map((a) => ({
        ...a,
        isRead: readNotificationIds.has(a._id),
      })),
    ];

    return merged.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

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
      .withIndex("by_recipient", (q) => q.eq("recipientId", "all"))
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
