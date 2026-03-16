import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  toggleWatchlistHandler,
  isWatchedHandler,
  getWatchedAuctionsHandler,
  getWatchedAuctionIdsHandler,
} from "./watchlist";
import * as auth from "./lib/auth";
import * as auctions from "./auctions";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

vi.mock("./lib/auth", () => ({
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock("./auctions", () => ({
  toAuctionSummary: vi.fn((_ctx, a) =>
    Promise.resolve({ _id: a._id, title: "Auction" })
  ),
  AuctionSummaryValidator: { fields: {} },
}));

interface MockQuery {
  withIndex: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  paginate: ReturnType<typeof vi.fn>;
}

interface MockCtx {
  db: {
    query: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
}

describe("Watchlist Coverage", () => {
  let mockCtx: MockCtx;
  let queryMock: MockQuery;

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
      first: vi.fn().mockResolvedValue(null),
      paginate: vi.fn().mockResolvedValue({
        page: [],
        isDone: true,
        continueCursor: "",
      }),
    };
    mockCtx = {
      db: {
        query: vi.fn(() => queryMock),
        insert: vi.fn().mockResolvedValue("id123"),
        delete: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue({ _id: "a1", title: "Test" }),
      },
    };
  });

  describe("toggleWatchlistHandler", () => {
    it("should throw if resolveUserId returns null", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue(null);

      await expect(
        toggleWatchlistHandler(mockCtx as unknown as MutationCtx, {
          auctionId: "a1" as Id<"auctions">,
        })
      ).rejects.toThrow("Unable to determine user ID");
    });

    it("should delete if existing", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      queryMock.first.mockResolvedValue({ _id: "w1" });

      const result = await toggleWatchlistHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );
      expect(result).toBe(false);
      expect(mockCtx.db.delete).toHaveBeenCalledWith("w1");
    });

    it("should insert if not existing", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      queryMock.first.mockResolvedValue(null);

      const result = await toggleWatchlistHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );
      expect(result).toBe(true);
      expect(mockCtx.db.insert).toHaveBeenCalledWith(
        "watchlist",
        expect.objectContaining({ auctionId: "a1" })
      );
    });
  });

  describe("isWatchedHandler", () => {
    it("should return true if existing", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      queryMock.first.mockResolvedValue({ _id: "w1" });

      const result = await isWatchedHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toBe(true);
    });

    it("should return false if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await isWatchedHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toBe(false);
    });

    it("should return false if resolveUserId returns null", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      const result = await isWatchedHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toBe(false);
    });

    it("should return false and log on error", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(new Error("Fail"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await isWatchedHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toBe(false);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should return false for unauthenticated error", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await isWatchedHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("getWatchedAuctionsHandler", () => {
    it("should return empty if resolveUserId returns null", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      const result = await getWatchedAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );
      expect(result.page).toHaveLength(0);
    });

    it("should return empty if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getWatchedAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );
      expect(result.page).toHaveLength(0);
    });

    it("should return paginated auctions", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      queryMock.paginate.mockResolvedValue({
        page: [{ auctionId: "a1" as Id<"auctions"> }],
        isDone: true,
        continueCursor: "next",
      });

      const result = await getWatchedAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );
      expect(result.page).toHaveLength(1);
      expect(auctions.toAuctionSummary).toHaveBeenCalled();
    });

    it("should filter out missing auctions", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      queryMock.paginate.mockResolvedValue({
        page: [{ auctionId: "a1" as Id<"auctions"> }],
        isDone: true,
        continueCursor: "next",
      });
      mockCtx.db.get.mockResolvedValue(null);

      const result = await getWatchedAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );
      expect(result.page).toHaveLength(0);
    });

    it("should handle error gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(new Error("Fail"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await getWatchedAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );
      expect(result.page).toHaveLength(0);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should handle unauthenticated error gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await getWatchedAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        { paginationOpts: { numItems: 10, cursor: null } }
      );
      expect(result.page).toHaveLength(0);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("getWatchedAuctionIdsHandler", () => {
    it("should return empty if resolveUserId returns null", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue(null);
      const result = await getWatchedAuctionIdsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveLength(0);
    });

    it("should paginate through all IDs", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");

      queryMock.paginate
        .mockResolvedValueOnce({
          page: [{ auctionId: "a1" as Id<"auctions"> }],
          isDone: false,
          continueCursor: "c1",
        })
        .mockResolvedValueOnce({
          page: [{ auctionId: "a2" as Id<"auctions"> }],
          isDone: true,
          continueCursor: "c2",
        });

      const result = await getWatchedAuctionIdsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toEqual(["a1", "a2"]);
      expect(queryMock.paginate).toHaveBeenCalledTimes(2);
    });

    it("should truncate after MAX_PAGES", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue({
        _id: "u1",
      } as unknown as { _id: string });
      vi.mocked(auth.resolveUserId).mockReturnValue("user1");
      queryMock.paginate.mockResolvedValue({
        page: [{ auctionId: "a" as Id<"auctions"> }],
        isDone: false,
        continueCursor: "c",
      });

      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await getWatchedAuctionIdsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveLength(10); // MAX_PAGES
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("truncated after 10 pages")
      );
      spy.mockRestore();
    });

    it("should handle error", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(new Error("Fail"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await getWatchedAuctionIdsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveLength(0);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should handle unauthenticated error", async () => {
      vi.mocked(auth.getAuthUser).mockRejectedValue(
        new Error("Unauthenticated")
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await getWatchedAuctionIdsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveLength(0);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
