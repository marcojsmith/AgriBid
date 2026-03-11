
import { describe, it, expect, vi, beforeEach } from "vitest";

import { 
  toggleWatchlistHandler, 
  isWatchedHandler, 
  getWatchedAuctionsHandler, 
  getWatchedAuctionIdsHandler 
} from "./watchlist";
import * as auth from "./lib/auth";
import * as auctions from "./auctions";
import { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

vi.mock("./lib/auth", () => ({
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock("./auctions", () => ({
  toAuctionSummary: vi.fn(),
  AuctionSummaryValidator: {},
}));

type MockCtxType = {
  db: {
    get: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
};

describe("Watchlist Coverage", () => {
  let mockCtx: MockCtxType;
  
  const mockUser: NonNullable<Awaited<ReturnType<typeof auth.getAuthUser>>> = {
    _id: "u1",
    userId: "u1",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          paginate: vi.fn().mockResolvedValue({ page: [], isDone: true, continueCursor: "" }),
        })),
      },
    };
  });

  describe("toggleWatchlistHandler", () => {
    it("should add to watchlist if not existing", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      
      const result = await toggleWatchlistHandler(mockCtx as unknown as MutationCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).toBe(true);
      expect(mockCtx.db.insert).toHaveBeenCalledWith("watchlist", { userId: "u1", auctionId: "a1" });
    });

    it("should remove from watchlist if existing", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ _id: "w1" })
      });

      const result = await toggleWatchlistHandler(mockCtx as unknown as MutationCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).toBe(false);
      expect(mockCtx.db.delete).toHaveBeenCalledWith("w1");
    });
  });

  describe("isWatchedHandler", () => {
    it("should return false if unauthenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await isWatchedHandler(mockCtx as unknown as QueryCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).toBe(false);
    });

    it("should return true if watched", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({ _id: "w1" })
      });

      const result = await isWatchedHandler(mockCtx as unknown as QueryCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).toBe(true);
    });

    it("should handle error gracefully", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      mockCtx.db.query = vi.fn().mockImplementation(() => { throw new Error("DB fail"); });
      
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = await isWatchedHandler(mockCtx as unknown as QueryCtx, { auctionId: "a1" as Id<"auctions"> });
      expect(result).toBe(false);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("getWatchedAuctionsHandler", () => {
    it("should return empty pagination if unauthenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getWatchedAuctionsHandler(mockCtx as unknown as QueryCtx, { paginationOpts: {} });
      expect(result.page).toHaveLength(0);
      expect(result.isDone).toBe(true);
    });

    it("should return enriched auction summaries", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");
      
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        paginate: vi.fn().mockResolvedValue({ 
          page: [{ auctionId: "a1" }, { auctionId: "a2" }], 
          isDone: true, 
          continueCursor: "c1" 
        })
      });

      mockCtx.db.get.mockImplementation(async (id: string) => {
        if (id === "a1") return { _id: "a1" };
        if (id === "a2") return null; // Simulate deleted auction
        return null;
      });

      vi.mocked(auctions.toAuctionSummary).mockResolvedValue({ _id: "a1", title: "Auction 1" } as any);

      const result = await getWatchedAuctionsHandler(mockCtx as unknown as QueryCtx, { paginationOpts: {} });
      expect(result.page).toHaveLength(1);
      expect(result.page[0].title).toBe("Auction 1");
      expect(auctions.toAuctionSummary).toHaveBeenCalledTimes(1);
    });
  });

  describe("getWatchedAuctionIdsHandler", () => {
    it("should fetch all IDs across pages", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      let callCount = 0;
      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        paginate: vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return { page: [{ auctionId: "a1" }], isDone: false, continueCursor: "c2" };
          }
          return { page: [{ auctionId: "a2" }], isDone: true, continueCursor: "c3" };
        })
      });

      const result = await getWatchedAuctionIdsHandler(mockCtx as unknown as QueryCtx);
      expect(result).toEqual(["a1", "a2"]);
      expect(callCount).toBe(2);
    });

    it("should respect MAX_PAGES safety cap", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      mockCtx.db.query = vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnThis(),
        paginate: vi.fn().mockResolvedValue({ page: [{ auctionId: "ax" }], isDone: false, continueCursor: "cx" })
      });

      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const result = await getWatchedAuctionIdsHandler(mockCtx as unknown as QueryCtx);
      expect(result).toHaveLength(10); // MAX_PAGES = 10
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("truncated after 10 pages"));
      spy.mockRestore();
    });
  });
});
