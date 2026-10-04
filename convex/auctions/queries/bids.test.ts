import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getMyBidsHandler,
  getMyBidsCountHandler,
  getMyBidsStatsHandler,
  computeLotStatsForUser,
  parseCursor,
  encodeCursor,
} from "./bids";
import { getAuthenticatedUserId, calculateUserBidStats } from "./shared";
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

vi.mock("../../_generated/server", () => ({
  query: vi.fn((q: unknown) => q),
  internalMutation: vi.fn((m: unknown) => m),
}));

vi.mock("./shared", async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    getAuthenticatedUserId: vi.fn(),
    calculateUserBidStats: vi.fn(),
  };
});

describe("cursor utilities", () => {
  it("parses cursor with timestamp only", () => {
    const result = parseCursor("1000");
    expect(result).toEqual({ timestamp: 1000 });
  });

  it("parses cursor with timestamp and id", () => {
    const result = parseCursor("1000:bid123");
    expect(result).toEqual({ timestamp: 1000, id: "bid123" });
  });

  it("returns null for empty cursor", () => {
    expect(parseCursor("")).toBeNull();
  });

  it("returns null for invalid timestamp", () => {
    expect(parseCursor("abc")).toBeNull();
  });

  it("returns null for invalid cursor format", () => {
    expect(parseCursor("a:b:c")).toBeNull();
  });

  it("encodes cursor with timestamp only", () => {
    expect(encodeCursor(1000)).toBe("1000");
  });

  it("encodes cursor with timestamp and id", () => {
    expect(encodeCursor(1000, "bid123")).toBe("1000:bid123");
  });
});

describe("getMyBidsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty page when unauthenticated", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);

    const mockCtx = {
      db: { query: vi.fn(), get: vi.fn() },
    } as unknown as QueryCtx;

    const result = await getMyBidsHandler(mockCtx, {
      paginationOpts: { numItems: 10, cursor: null },
    });

    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
    expect(result.totalCount).toBe(0);
  });
});

describe("computeLotStatsForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes stats for given lots", async () => {
    const userId = "user1";
    const lotIds = new Set<Id<"lots">>(["lot1" as Id<"lots">]);

    const bidsForLot = [
      { amount: 100, timestamp: 1000 },
      { amount: 150, timestamp: 500 },
    ];

    const mockCollect = vi.fn().mockResolvedValue(bidsForLot);
    const mockQuery = vi.fn().mockReturnValue({
      withIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      collect: mockCollect,
    });

    const mockCtx = {
      db: { query: mockQuery },
    } as unknown as QueryCtx;

    const result = await computeLotStatsForUser(mockCtx, userId, lotIds);

    expect(result.size).toBe(1);
    const stats = result.get("lot1" as Id<"lots">);
    expect(stats).toEqual({
      highestBid: 150,
      lastBidTimestamp: 1000,
      bidCount: 2,
    });
  });

  it("returns empty map for empty lot set", async () => {
    const userId = "user1";
    const lotIds = new Set<Id<"lots">>();

    const mockCtx = {
      db: { query: vi.fn() },
    } as unknown as QueryCtx;

    const result = await computeLotStatsForUser(mockCtx, userId, lotIds);

    expect(result.size).toBe(0);
  });
});

describe("getMyBidsCountHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when unauthenticated", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);

    const mockCtx = {
      db: { query: vi.fn() },
    } as unknown as QueryCtx;

    const result = await getMyBidsCountHandler(mockCtx);

    expect(result).toBe(0);
  });
});

describe("getMyBidsStatsHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero stats when unauthenticated", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
    vi.mocked(calculateUserBidStats).mockResolvedValue({
      globalStats: {
        totalActive: 0,
        winningCount: 0,
        outbidCount: 0,
        totalExposure: 0,
      },
      auctionStatsMap: new Map(),
      auctionsMap: new Map(),
    });

    const mockCtx = {
      db: { query: vi.fn() },
    } as unknown as QueryCtx;

    const result = await getMyBidsStatsHandler(mockCtx);

    expect(result).toEqual({
      totalActive: 0,
      winningCount: 0,
      outbidCount: 0,
      totalExposure: 0,
    });
  });
});
