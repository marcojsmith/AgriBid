import { describe, it, expect, vi, beforeEach } from "vitest";

import * as auth from "./lib/auth";
import {
  getMyNotificationsHandler,
  getNotificationArchiveHandler,
  markAsReadHandler,
  markAllReadHandler,
} from "./notifications";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

vi.mock("./lib/auth", () => ({
  getAuthUser: vi.fn(),
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
}));

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

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn(),
        patch: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          take: vi.fn().mockResolvedValue([]),
          unique: vi.fn().mockResolvedValue(null),
          collect: vi.fn().mockResolvedValue([]),
        })),
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

    it("should return notifications for authenticated user", async () => {
      const authUser: Awaited<ReturnType<typeof auth.getAuthUser>> = {
        userId: "u1",
        _id: "u1",
        _creationTime: Date.now(),
      };
      vi.mocked(auth.getAuthUser).mockResolvedValue(authUser);
      const result = await getMyNotificationsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("getNotificationArchiveHandler", () => {
    it("should return history", async () => {
      const authUser: Awaited<ReturnType<typeof auth.getAuthUser>> = {
        userId: "u1",
        _id: "u1",
        _creationTime: Date.now(),
      };
      vi.mocked(auth.getAuthUser).mockResolvedValue(authUser);
      const result = await getNotificationArchiveHandler(
        mockCtx as unknown as QueryCtx,
        { limit: 10 }
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("markAsReadHandler", () => {
    it("should mark personal notification as read", async () => {
      const authResult: Awaited<ReturnType<typeof auth.requireAuth>> = {
        userId: "u1",
        _id: "u1",
        _creationTime: Date.now(),
      };
      vi.mocked(auth.requireAuth).mockResolvedValue(authResult);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.get.mockResolvedValue({
        _id: "n1",
        recipientId: "u1",
        isRead: false,
      });

      const result = await markAsReadHandler(
        mockCtx as unknown as MutationCtx,
        {
          notificationId: "n1" as Id<"notifications">,
        }
      );

      expect(result).toBeNull();
      expect(mockCtx.db.patch).toHaveBeenCalledWith("n1", { isRead: true });
    });
  });

  describe("markAllReadHandler", () => {
    it("should mark all as read", async () => {
      const authResult: Awaited<ReturnType<typeof auth.requireAuth>> = {
        userId: "u1",
        _id: "u1",
        _creationTime: Date.now(),
      };
      vi.mocked(auth.requireAuth).mockResolvedValue(authResult);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      const result = await markAllReadHandler(
        mockCtx as unknown as MutationCtx
      );
      expect(result).toBeNull();
    });
  });
});
