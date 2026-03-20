import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConvexError } from "convex/values";

import * as auth from "./lib/auth";
import {
  getMyNotificationsHandler,
  getNotificationArchiveHandler,
  markAsReadHandler,
  markAllReadHandler,
} from "./notifications";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { AuthUser } from "./auth";
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
      withIndex: vi.fn((_index, cb) => {
        if (cb) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- test mock: cb is a query builder callback from vi.fn() mock
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
      queryMock.collect
        .mockResolvedValueOnce([
          { _id: "n1", createdAt: 100, recipientId: "user1" },
        ])
        .mockResolvedValueOnce([
          { _id: "a1", createdAt: 200, recipientId: "all" },
        ]);

      queryMock.unique.mockResolvedValue({ notificationId: "a1" });

      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx,
        defaultArgs
      );
      expect(result.page).toHaveLength(2);
      expect(result.page[0]._id).toBe("a1");
      expect(result.page[0].isRead).toBe(true);
      expect(result.page[1].isRead).toBeUndefined();
    });

    it("should use fallback _id if userId is missing", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
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
      queryMock.collect
        .mockResolvedValueOnce([{ _id: "n1", createdAt: 100 }])
        .mockResolvedValueOnce([]);

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
      expect(mockCtx.db.patch).toHaveBeenCalledWith("n1", { isRead: true });
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

      queryMock.unique
        .mockResolvedValueOnce({ notificationId: "a1" }) // a1 already read
        .mockResolvedValueOnce(null); // a2 not read

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
});
