
import { describe, it, expect, vi, beforeEach } from "vitest";

import { 
  getMyNotificationsHandler, 
  getNotificationArchiveHandler,
  markAsReadHandler,
  markAllReadHandler
} from "./notifications";
import * as auth from "./lib/auth";
import type { Id } from "./_generated/dataModel";

vi.mock("./lib/auth", () => ({
  getAuthUser: vi.fn(),
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
}));

describe("Notifications Coverage", () => {
  let mockCtx: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
          collect: vi.fn().mockResolvedValue([]),
          take: vi.fn().mockResolvedValue([]),
        })),
      },
    };
  });

  describe("getMyNotificationsHandler", () => {
    it("should return empty if unauthenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getMyNotificationsHandler(mockCtx);
      expect(result).toHaveLength(0);
    });

    it("should handle authenticated user and merge notifications", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({ userId: "u1" } as any);
      
      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "notifications") {
          return {
            withIndex: vi.fn().mockImplementation((index, qFn) => {
              const q = { eq: vi.fn().mockReturnThis() };
              const filterValue = qFn(q).eq.mock.calls[0][1];
              return {
                order: vi.fn().mockReturnThis(),
                take: vi.fn().mockResolvedValue(
                  filterValue === "u1" 
                    ? [{ _id: "n1", createdAt: 100, recipientId: "u1" }] 
                    : [{ _id: "a1", createdAt: 150, recipientId: "all" }]
                ),
              };
            }),
          };
        }
        return { withIndex: vi.fn().mockReturnThis(), unique: vi.fn().mockResolvedValue(null) };
      });

      const result = await getMyNotificationsHandler(mockCtx);
      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe("a1"); // Sorted by createdAt desc
    });

    it("should handle error gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(new Error("Critical"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      const result = await getMyNotificationsHandler(mockCtx);
      expect(result).toHaveLength(0);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("getNotificationArchiveHandler", () => {
    it("should return empty if unauthenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getNotificationArchiveHandler(mockCtx, {});
      expect(result).toHaveLength(0);
    });

    it("should cap limit and return sorted notifications", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({ userId: "u1" } as any);
      
      const personal = [
        { _id: "n2", createdAt: 200, recipientId: "u1" },
        { _id: "n1", createdAt: 100, recipientId: "u1" },
      ];
      const announcements = [
        { _id: "a1", createdAt: 150, recipientId: "all" },
      ];

      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "notifications") {
          return {
            withIndex: vi.fn().mockImplementation((index, qFn) => {
              const q = { eq: vi.fn().mockReturnThis() };
              const filterValue = qFn(q).eq.mock.calls[0][1];
              return {
                order: vi.fn().mockReturnThis(),
                take: vi.fn().mockResolvedValue(filterValue === "u1" ? personal : announcements),
              };
            }),
          };
        }
        return { withIndex: vi.fn().mockReturnThis(), unique: vi.fn().mockResolvedValue(null) };
      });

      const result = await getNotificationArchiveHandler(mockCtx, { limit: 2 });
      expect(result).toHaveLength(2);
      expect(result[0]._id).toBe("n2");
      expect(result[1]._id).toBe("a1");
    });
  });

  describe("markAsReadHandler", () => {
    it("should throw if notification not found", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({ userId: "u1" } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.get.mockResolvedValue(null);

      await expect(markAsReadHandler(mockCtx, { notificationId: "n1" as Id<"notifications"> }))
        .rejects.toThrow("Notification not found");
    });

    it("should insert read receipt for broadcast", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({ userId: "u1" } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "n1", recipientId: "all" });

      await markAsReadHandler(mockCtx, { notificationId: "n1" as Id<"notifications"> });
      expect(mockCtx.db.insert).toHaveBeenCalledWith("readReceipts", expect.objectContaining({
        userId: "u1",
        notificationId: "n1",
      }));
    });

    it("should patch personal notification", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({ userId: "u1" } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "n1", recipientId: "u1" });

      await markAsReadHandler(mockCtx, { notificationId: "n1" as Id<"notifications"> });
      expect(mockCtx.db.patch).toHaveBeenCalledWith("n1", { isRead: true });
    });

    it("should throw if notification belongs to someone else", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({ userId: "u1" } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.get.mockResolvedValue({ _id: "n1", recipientId: "u2" });

      await expect(markAsReadHandler(mockCtx, { notificationId: "n1" as Id<"notifications"> }))
        .rejects.toThrow("Unauthorized");
    });
  });

  describe("markAllReadHandler", () => {
    it("should mark all personal and broadcast as read with chunking", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({ userId: "u1" } as any);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      
      const manyPersonal = Array.from({ length: 60 }, (_, i) => ({ _id: `p${i}`, recipientId: "u1" }));
      const manyAnnouncements = Array.from({ length: 20 }, (_, i) => ({ _id: `a${i}`, recipientId: "all" }));

      mockCtx.db.query = vi.fn().mockImplementation((table) => {
        if (table === "notifications") {
          return {
            withIndex: vi.fn().mockImplementation((index, qFn) => {
              const q = { eq: vi.fn().mockReturnThis() };
              const qResult = qFn(q);
              const filterValue = qResult.eq.mock.calls[0][1];
              return {
                order: vi.fn().mockReturnThis(),
                take: vi.fn().mockResolvedValue(filterValue === "u1" ? manyPersonal : manyAnnouncements),
              };
            }),
          };
        }
        if (table === "readReceipts") {
          return {
            withIndex: vi.fn().mockReturnThis(),
            unique: vi.fn().mockResolvedValue(null),
          };
        }
      });

      await markAllReadHandler(mockCtx);
      expect(mockCtx.db.patch).toHaveBeenCalledTimes(60);
      expect(mockCtx.db.insert).toHaveBeenCalledTimes(20);
    });
  });
});
