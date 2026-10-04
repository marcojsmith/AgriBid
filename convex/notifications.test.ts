import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import * as auth from "./lib/auth";
import {
  getMyNotificationsHandler,
  getNotificationArchiveHandler,
  markAsReadHandler,
  markAllReadHandler,
  batchFetchReadCounts,
} from "./notifications";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { AuthUser } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

vi.mock("./lib/auth", () => ({
  getAuthUser: vi.fn(),
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
}));

interface QueryMock {
  withIndex: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  take: ReturnType<typeof vi.fn>;
  unique: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
  paginate: ReturnType<typeof vi.fn>;
}

interface MockCtxType {
  db: {
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
}

describe("Notifications Coverage", () => {
  let mockCtx: MockCtxType;
  let queryMock: QueryMock;

  beforeEach(() => {
    vi.resetAllMocks();
    queryMock = {
      withIndex: vi.fn((_index: string, cb?: (q: unknown) => unknown) => {
        if (cb) {
          cb({
            eq: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            lt: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
          });
        }
        return queryMock;
      }),
      order: vi.fn().mockReturnThis(),
      take: vi.fn().mockResolvedValue([]),
      unique: vi.fn().mockResolvedValue(null),
      collect: vi.fn().mockResolvedValue([]),
      paginate: vi.fn(),
    };
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn().mockResolvedValue(undefined),
        query: vi.fn(() => queryMock),
      },
    };
  });

  describe("getMyNotificationsHandler", () => {
    const defaultArgs = {
      paginationOpts: { numItems: 20, cursor: null as string | null },
    };

    it("should return empty paginated result if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        defaultArgs
      );
      expect(result.page).toHaveLength(0);
      expect(result.isDone).toBe(true);
    });

    it("should merge and sort personal and announcements", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);
      queryMock.take
        .mockResolvedValueOnce([
          { _id: "n1", createdAt: 100, recipientId: "user1", _creationTime: 100 },
        ])
        .mockResolvedValueOnce([
          { _id: "a1", createdAt: 200, recipientId: "all", _creationTime: 200 },
        ]);
      queryMock.collect.mockResolvedValueOnce([{ notificationId: "a1" }]);

      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        defaultArgs
      );
      expect(result.page).toHaveLength(2);
      expect(result.page[0]._id).toBe("a1");
      expect(result.page[0].isRead).toBe(true);
      expect(result.page[1].isRead).toBe(false);
    });

    it("should paginate 500+ notifications completely with no duplicates or misses", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);

      const personalNotifications = Array.from({ length: 300 }, (_, i) => ({
        _id: `n${String(i).padStart(3, "0")}` as Id<"notifications">,
        createdAt: 100000 - i * 100,
        _creationTime: 100000 - i * 100,
        recipientId: "user1",
        type: "info" as const,
        title: `Personal ${String(i)}`,
        message: `Message ${String(i)}`,
        isRead: false,
      }));
      const announcements = Array.from({ length: 250 }, (_, i) => ({
        _id: `a${String(i).padStart(3, "0")}` as Id<"notifications">,
        createdAt: 100050 - i * 100,
        _creationTime: 100050 - i * 100,
        recipientId: "all",
        type: "info" as const,
        title: `Announcement ${String(i)}`,
        message: `Announcement Message ${String(i)}`,
        isRead: false,
      }));

      const allNotifications = [...personalNotifications, ...announcements].sort(
        (a, b) => b.createdAt - a.createdAt
      );

      let personalCursor: number | null = null;
      let announcementCursor: number | null = null;

      queryMock.take.mockImplementation((limit: number) => {
        const callNum = queryMock.take.mock.calls.length;
        if (callNum % 2 === 1) {
          let slice = personalNotifications;
          if (personalCursor !== null) {
            const cursor = personalCursor;
            slice = personalNotifications.filter(n => n.createdAt < cursor);
          }
          return Promise.resolve(slice.slice(0, limit));
        } else {
          let slice = announcements;
          if (announcementCursor !== null) {
            const cursor = announcementCursor;
            slice = announcements.filter(n => n.createdAt < cursor);
          }
          return Promise.resolve(slice.slice(0, limit));
        }
      });

      queryMock.collect.mockResolvedValue([]);

      const collectedIds: string[] = [];
      let cursor: string | null = null;
      let isDone = false;

      while (!isDone) {
        const result = await getMyNotificationsHandler(
          mockCtx as unknown as QueryCtx,
          { paginationOpts: { numItems: 50, cursor } }
        );
        collectedIds.push(...result.page.map((n) => n._id));
        isDone = result.isDone;
        cursor = result.continueCursor || null;

        if (result.page.length > 0) {
          const personalItems = result.page.filter(n => n.recipientId !== "all");
          const announcementItems = result.page.filter(n => n.recipientId === "all");
          if (personalItems.length > 0) {
            personalCursor = personalItems[personalItems.length - 1].createdAt;
          }
          if (announcementItems.length > 0) {
            announcementCursor = announcementItems[announcementItems.length - 1].createdAt;
          }
        }
      }

      expect(collectedIds).toHaveLength(allNotifications.length);
      const expectedIds = allNotifications.map((n) => n._id);
      expect(collectedIds).toEqual(expectedIds);

      const uniqueIds = new Set(collectedIds);
      expect(uniqueIds.size).toBe(collectedIds.length);
    });

    it("should handle notification inserted between page fetches without duplicates", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);

      const baseNotifications = Array.from({ length: 30 }, (_, i) => ({
        _id: `n${String(i).padStart(2, "0")}` as Id<"notifications">,
        createdAt: 10000 - i * 100,
        _creationTime: 10000 - i * 100,
        recipientId: "user1",
        type: "info" as const,
        title: `Title ${String(i)}`,
        message: `Message ${String(i)}`,
        isRead: false,
      }));

      let notifications = [...baseNotifications];
      let callCount = 0;
      let currentCursor: number | null = null;

      queryMock.take.mockImplementation((limit: number) => {
        callCount++;
        if (callCount === 3) {
          notifications = [
            {
              _id: "n-new" as Id<"notifications">,
              createdAt: 10000 + 100,
              _creationTime: 10000 + 100,
              recipientId: "user1",
              type: "info" as const,
              title: "New Inserted",
              message: "New Message",
              isRead: false,
            },
            ...baseNotifications,
          ];
        }
        let slice = notifications;
        if (currentCursor !== null) {
          const cursor = currentCursor;
          slice = notifications.filter(n => n.createdAt < cursor);
        }
        return Promise.resolve(slice.slice(0, limit));
      });

      queryMock.collect.mockResolvedValue([]);

      const firstPage = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 20, cursor: null } }
      );

      expect(firstPage.page).toHaveLength(20);

      if (firstPage.page.length > 0) {
        currentCursor = firstPage.page[firstPage.page.length - 1].createdAt;
      }

      const secondPage = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 20, cursor: firstPage.continueCursor } }
      );

      const firstPageIds = new Set(firstPage.page.map((n) => n._id));
      const secondPageIds = new Set(secondPage.page.map((n) => n._id));
      
      for (const id of secondPageIds) {
        expect(firstPageIds.has(id)).toBe(false);
      }
    });

    it("should handle malformed cursor gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);

      queryMock.take
        .mockResolvedValueOnce([
          { _id: "n1", createdAt: 100, recipientId: "user1", _creationTime: 100 },
        ])
        .mockResolvedValueOnce([]);
      queryMock.collect.mockResolvedValue([]);

      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: "not-valid-json" } }
      );

      expect(result.page.length).toBeGreaterThanOrEqual(0);
      expect(result.isDone).toBeDefined();
    });

    it("should interleave announcements in correct time order", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);

      queryMock.take
        .mockResolvedValueOnce([
          { _id: "n1", createdAt: 300, recipientId: "user1", _creationTime: 300 },
          { _id: "n2", createdAt: 100, recipientId: "user1", _creationTime: 100 },
        ])
        .mockResolvedValueOnce([
          { _id: "a1", createdAt: 200, recipientId: "all", _creationTime: 200 },
        ]);
      queryMock.collect.mockResolvedValue([]);

      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );

      expect(result.page).toHaveLength(3);
      expect(result.page[0]._id).toBe("n1");
      expect(result.page[1]._id).toBe("a1");
      expect(result.page[2]._id).toBe("n2");
    });

    it("should use fallback _id if userId is missing", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      queryMock.take.mockResolvedValue([]);
      queryMock.collect.mockResolvedValue([]);
      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        defaultArgs
      );
      expect(result.page).toHaveLength(0);
    });

    it("should suppress console.error for unauthenticated errors", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {
        return;
      });
      await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        defaultArgs
      );
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should handle catch block for non-auth errors", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(new Error("DB Fail"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {
        return;
      });
      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        defaultArgs
      );
      expect(result.page).toHaveLength(0);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should handle empty announcements array", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);
      queryMock.take
        .mockResolvedValueOnce([{ _id: "n1", createdAt: 100, _creationTime: 100 }])
        .mockResolvedValueOnce([]);
      queryMock.collect.mockResolvedValue([]);

      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        defaultArgs
      );
      expect(result.page).toHaveLength(1);
    });
  });

  describe("getNotificationArchiveHandler", () => {
    it("should use capped limit and sort", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);
      queryMock.take.mockResolvedValue([]);

      const result = await getNotificationArchiveHandler(
        mockCtx as unknown as QueryCtx,
        { limit: 200 }
      );
      expect(auth.getAuthUser).toHaveBeenCalledWith(mockCtx);
      expect(queryMock.take).toHaveBeenCalledWith(100); // capped
      expect(result).toHaveLength(0);
    });

    it("should sort merged notifications by createdAt descending", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);

      // Return personal notifications with different createdAt values
      queryMock.take
        .mockResolvedValueOnce([
          {
            _id: "n1",
            createdAt: 100,
            recipientId: "user1",
            type: "bid" as const,
            title: "Title 1",
            message: "Msg 1",
            isRead: false,
          },
          {
            _id: "n2",
            createdAt: 300,
            recipientId: "user1",
            type: "bid" as const,
            title: "Title 2",
            message: "Msg 2",
            isRead: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            _id: "a1",
            createdAt: 200,
            recipientId: "all",
            type: "announcement" as const,
            title: "Ann 1",
            message: "Ann Msg 1",
            isRead: false,
          },
        ]);

      const result = await getNotificationArchiveHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toHaveLength(3);
      // Should be sorted by createdAt descending: n2 (300), a1 (200), n1 (100)
      expect(result[0]._id).toBe("n2");
      expect(result[1]._id).toBe("a1");
      expect(result[2]._id).toBe("n1");
    });

    it("should handle userId fallback", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      queryMock.take.mockResolvedValue([]);
      const result = await getNotificationArchiveHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(auth.getAuthUser).toHaveBeenCalledWith(mockCtx);
      expect(queryMock.take).toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it("should suppress console.error for unauthenticated errors", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {
        return;
      });
      await getNotificationArchiveHandler(mockCtx as unknown as QueryCtx, {});
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should return empty array when user is not authenticated (null)", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getNotificationArchiveHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toHaveLength(0);
    });

    it("should handle error gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(new Error("Fail"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {
        return;
      });
      const result = await getNotificationArchiveHandler(
        mockCtx as unknown as QueryCtx,
        {}
      );
      expect(result).toHaveLength(0);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("markAsReadHandler", () => {
    it("should throw if resolveUserId fails", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      await expect(
        markAsReadHandler(mockCtx as unknown as MutationCtx, {
          notificationId: "n1" as Id<"notifications">,
        })
      ).rejects.toThrow("Unable to determine user ID");
    });

    it("should throw if notification not found", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      mockCtx.db.get.mockResolvedValue(null);
      await expect(
        markAsReadHandler(mockCtx as unknown as MutationCtx, {
          notificationId: "n1" as Id<"notifications">,
        })
      ).rejects.toThrow(ConvexError);
    });

    it("should create read receipt for global announcement", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      mockCtx.db.get.mockResolvedValue({ _id: "a1", recipientId: "all" });
      queryMock.unique.mockResolvedValue(null); // not yet read

      await markAsReadHandler(mockCtx as unknown as MutationCtx, {
        notificationId: "a1" as Id<"notifications">,
      });
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "readReceipts",
        expect.objectContaining({
          userId: "user1",
          notificationId: "a1",
        })
      );
    });

    it("should do nothing if read receipt already exists", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      mockCtx.db.get.mockResolvedValue({ _id: "a1", recipientId: "all" });
      queryMock.unique.mockResolvedValue({ _id: "r1" }); // already exists

      await markAsReadHandler(mockCtx as unknown as MutationCtx, {
        notificationId: "a1" as Id<"notifications">,
      });
      expect(mockCtx.db.insert).not.toHaveBeenCalled();
    });

    it("should throw if personal notification belongs to someone else", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      mockCtx.db.get.mockResolvedValue({ _id: "n1", recipientId: "user2" });

      await expect(
        markAsReadHandler(mockCtx as unknown as MutationCtx, {
          notificationId: "n1" as Id<"notifications">,
        })
      ).rejects.toThrow(ConvexError);
    });

    it("should successfully mark personal notification as read", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      mockCtx.db.get.mockResolvedValue({
        _id: "n1",
        recipientId: "user1",
        isRead: false,
      });

      await markAsReadHandler(mockCtx as unknown as MutationCtx, {
        notificationId: "n1" as Id<"notifications">,
      });

      expect(mockCtx.db.patch).toHaveBeenCalledTimes(1);
      expect(mockCtx.db.patch).toHaveBeenCalledWith("notifications", "n1", {
        isRead: true,
      });
      expect(mockCtx.db.insert).not.toHaveBeenCalled();
    });
  });

  describe("markAllReadHandler", () => {
    it("should mark all as read including announcements", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");

      // unread personal
      queryMock.take
        .mockResolvedValueOnce([{ _id: "n1" }, { _id: "n2" }]) // personal unread
        .mockResolvedValueOnce([{ _id: "a1" }, { _id: "a2" }]); // announcements

      queryMock.collect.mockResolvedValueOnce([{ notificationId: "a1" }]); // a1 already read, a2 not

      await markAllReadHandler(mockCtx as unknown as MutationCtx);

      expect(mockCtx.db.patch).toHaveBeenCalledTimes(2); // n1, n2
      expect(mockCtx.db.insert).toHaveBeenCalledTimes(1); // a2 only
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "readReceipts",
        expect.objectContaining({
          notificationId: "a2",
          userId: "user1",
        })
      );
    });

    it("should throw if user ID cannot be resolved", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      await expect(
        markAllReadHandler(mockCtx as unknown as MutationCtx)
      ).rejects.toThrow("Unable to determine user ID");
    });

    it("should handle large number of notifications via chunking", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");

      // 60 personal notifications (2 batches of 50)
      const personal = Array.from({ length: 60 }, (_, i) => ({
        _id: `n${String(i)}`,
      }));
      queryMock.take.mockResolvedValueOnce(personal).mockResolvedValueOnce([]); // no announcements

      await markAllReadHandler(mockCtx as unknown as MutationCtx);
      expect(mockCtx.db.patch).toHaveBeenCalledTimes(60);
    });
  });

  describe("batchFetchReadCounts", () => {
    it("should return empty Map for empty input array", async () => {
      const result = await batchFetchReadCounts(
        mockCtx as unknown as QueryCtx,
        []
      );
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockCtx.db.query).not.toHaveBeenCalled();
    });

    it("should fetch read counts for each notification", async () => {
      const notificationIds = [
        "n1",
        "n2",
        "n3",
      ] as unknown as Id<"notifications">[];
      queryMock.collect
        .mockResolvedValueOnce([{ _id: "r1" }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ _id: "r2" }, { _id: "r3" }]);

      const result = await batchFetchReadCounts(
        mockCtx as unknown as QueryCtx,
        notificationIds
      );

      expect(result.get("n1" as Id<"notifications">)).toBe(1);
      expect(result.get("n2" as Id<"notifications">)).toBe(0);
      expect(result.get("n3" as Id<"notifications">)).toBe(2);
    });
  });
});
