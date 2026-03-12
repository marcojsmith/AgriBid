import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  toggleWatchlistHandler,
  isWatchedHandler,
  getWatchedAuctionsHandler,
  getWatchedAuctionIdsHandler,
} from "./watchlist";
import * as auth from "./lib/auth";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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

  const mockUser = {
    userId: "u1",
  } as unknown as NonNullable<Awaited<ReturnType<typeof auth.getAuthUser>>>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockCtx = {
      db: {
        get: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn(),
        query: vi.fn(() => ({
          withIndex: vi.fn().mockReturnThis(),
          unique: vi.fn().mockResolvedValue(null),
          first: vi.fn().mockResolvedValue(null),
          paginate: vi
            .fn()
            .mockResolvedValue({ page: [], isDone: true, continueCursor: "" }),
        })),
      },
    };
  });

  describe("toggleWatchlistHandler", () => {
    it("should add to watchlist", async () => {
      vi.mocked(auth.requireAuth).mockResolvedValue(mockUser);
      vi.mocked(auth.resolveUserId).mockReturnValue("u1");

      const result = await toggleWatchlistHandler(
        mockCtx as unknown as MutationCtx,
        {
          auctionId: "a1" as Id<"auctions">,
        }
      );

      expect(result).toBe(true);
      expect(mockCtx.db.insert).toHaveBeenCalled();
    });
  });

  describe("isWatchedHandler", () => {
    it("should return false if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await isWatchedHandler(mockCtx as unknown as QueryCtx, {
        auctionId: "a1" as Id<"auctions">,
      });
      expect(result).toBe(false);
    });
  });

  describe("getWatchedAuctionsHandler", () => {
    it("should return empty list if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getWatchedAuctionsHandler(
        mockCtx as unknown as QueryCtx,
        {
          paginationOpts: { numItems: 10, cursor: null },
        }
      );
      expect(result.page).toHaveLength(0);
    });
  });

  describe("getWatchedAuctionIdsHandler", () => {
    it("should return empty list if not authenticated", async () => {
      vi.mocked(auth.getAuthUser).mockResolvedValue(null);
      const result = await getWatchedAuctionIdsHandler(
        mockCtx as unknown as QueryCtx
      );
      expect(result).toHaveLength(0);
    });
  });
});
