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

type QueryMock = {
  withIndex: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  take: ReturnType<typeof vi.fn>;
  unique: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
};

type MockCtxType = {
  db: {
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
};

describe("Notifications Coverage", () => {
  let mockCtx: MockCtxType;
  let queryMock: QueryMock;

  beforeEach(() => {
    vi.resetAllMocks();
    queryMock = {
      withIndex: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      take: vi.fn().mockResolvedValue([]),
      unique: vi.fn().mockResolvedValue(null),
      collect: vi.fn().mockResolvedValue([]),
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
    it("should return empty if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveLength(0);
    });

    it("should merge and sort personal and announcements", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);
      queryMock.take
        .mockResolvedValueOnce([
          { _id: "n1", createdAt: 100, recipientId: "user1" },
        ]) // personal
        .mockResolvedValueOnce([
          { _id: "a1", createdAt: 200, recipientId: "all" },
        ]); // announcements

      queryMock.unique.mockResolvedValue({ notificationId: "a1" }); // read receipt for a1

      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe("a1"); // Sorted by createdAt desc
      expect(result[0].isRead).toBe(true);
      expect(result[1].isRead).toBeUndefined(); // Personal doesn't get isRead augmented in this handler logic
    });

    it("should handle catch block for non-auth errors", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(new Error("DB Fail"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveLength(0);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
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
      expect(queryMock.take).toHaveBeenCalledWith(100); // capped
      expect(result).toHaveLength(0);
    });

    it("should handle error gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(new Error("Fail"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
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
  });
});
