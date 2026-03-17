import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  heartbeat,
  getOnlineCount,
  cleanup,
  countOnlineUsers,
} from "./presence";
import * as auth from "./lib/auth";
import type { QueryCtx } from "./_generated/server";
import type { AuthUser } from "./auth";

vi.mock("./_generated/server", () => ({
  query: vi.fn((q) => q),
  mutation: vi.fn((m) => m),
  internalMutation: vi.fn((m) => m),
}));

vi.mock("./lib/auth", () => ({
  getAuthUser: vi.fn(),
}));

type QueryMock = {
  withIndex: ReturnType<typeof vi.fn>;
  unique: ReturnType<typeof vi.fn>;
  collect: ReturnType<typeof vi.fn>;
  take: ReturnType<typeof vi.fn>;
  count?: ReturnType<typeof vi.fn>;
};

type MockCtxType = {
  db: {
    query: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

describe("Presence Coverage", () => {
  let mockCtx: MockCtxType;
  let queryMock: QueryMock;

  beforeEach(() => {
    vi.resetAllMocks();
    queryMock = {
      withIndex: vi.fn((_index, cb) => {
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
      unique: vi.fn().mockResolvedValue(null),
      collect: vi.fn().mockResolvedValue([]),
      take: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
    mockCtx = {
      db: {
        query: vi.fn(() => queryMock),
        insert: vi.fn().mockResolvedValue("id123"),
        patch: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  describe("countOnlineUsers", () => {
    it("should use count() if available", async () => {
      queryMock.count!.mockResolvedValue(5);
      const result = await countOnlineUsers(mockCtx as unknown as QueryCtx);
      expect(result).toBe(5);
      expect(queryMock.count).toHaveBeenCalled();
    });

    it("should fallback to collect().length if count() is missing", async () => {
      delete queryMock.count;
      queryMock.collect.mockResolvedValue([{ _id: "p1" }, { _id: "p2" }]);
      const result = await countOnlineUsers(mockCtx as unknown as QueryCtx);
      expect(result).toBe(2);
      expect(queryMock.collect).toHaveBeenCalled();
    });
  });

  describe("heartbeat", () => {
    it("should insert new presence if not existing", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);
      queryMock.unique.mockResolvedValue(null);

      await (
        heartbeat as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});

      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "presence",
        expect.objectContaining({
          userId: "user1",
          updatedAt: expect.any(Number),
        })
      );
    });

    it("should patch existing presence", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
        userId: "user1",
      } as unknown as AuthUser);
      queryMock.unique.mockResolvedValue({ _id: "p1", userId: "user1" });

      await (
        heartbeat as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});

      expect(mockCtx.db.patch).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({
          updatedAt: expect.any(Number),
        })
      );
    });

    it("should fallback to _id if userId is missing", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      queryMock.unique.mockResolvedValue(null);

      await (
        heartbeat as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});

      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "presence",
        expect.objectContaining({
          userId: "u1",
        })
      );
    });

    it("should return null if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await (
        heartbeat as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});
      expect(result).toBeNull();
    });
  });

  describe("getOnlineCount", () => {
    it("should return online count if authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as AuthUser);
      queryMock.count!.mockResolvedValue(10);

      const result = await (
        getOnlineCount as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});
      expect(result).toBe(10);
    });

    it("should throw if unauthenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      await expect(
        (
          getOnlineCount as unknown as {
            handler: (...args: unknown[]) => Promise<unknown>;
          }
        ).handler(mockCtx, {})
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("cleanup", () => {
    it("should delete old records in batches", async () => {
      queryMock.take
        .mockResolvedValueOnce([{ _id: "p1" }, { _id: "p2" }])
        .mockResolvedValueOnce([]); // end loop

      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      await (
        cleanup as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});

      expect(mockCtx.db.delete).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Removed 2 stale records")
      );
      spy.mockRestore();
    });

    it("should handle large number of records across batches", async () => {
      const batch = Array(100)
        .fill(0)
        .map((_, i) => ({ _id: `p${i}` }));
      queryMock.take
        .mockResolvedValueOnce(batch)
        .mockResolvedValueOnce([{ _id: "p101" }])
        .mockResolvedValueOnce([]);

      await (
        cleanup as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});

      expect(mockCtx.db.delete).toHaveBeenCalledTimes(101);
    });

    it("should stop after MAX_ITERATIONS", async () => {
      const batch = Array(100)
        .fill(0)
        .map((_, i) => ({ _id: `p${i}` }));
      queryMock.take.mockResolvedValue(batch); // Always return full batch

      await (
        cleanup as unknown as {
          handler: (...args: unknown[]) => Promise<unknown>;
        }
      ).handler(mockCtx, {});

      // MAX_ITERATIONS is 10, so 10 * 100 = 1000 deletes
      expect(mockCtx.db.delete).toHaveBeenCalledTimes(1000);
    });
  });
});
