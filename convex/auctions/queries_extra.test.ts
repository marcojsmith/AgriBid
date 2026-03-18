import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { v } from "convex/values";

import * as auth from "../lib/auth";
import {
  getActiveAuctionsHandler,
  getAuctionBidsHandler,
  getMyBidsHandler,
} from "./queries";
import { authComponent } from "../auth";
import type { QueryCtx } from "../_generated/server";
import { findUserById } from "../users";
import type { Doc, Id } from "../_generated/dataModel";

vi.mock("../_generated/server", () => ({
  query: vi.fn((q) => q),
  mutation: vi.fn((m) => m),
}));

vi.mock("../lib/auth", () => ({
  getAuthUser: vi.fn(),
  requireAuth: vi.fn(),
  resolveUserId: vi.fn(),
  requireAdmin: vi.fn(),
  getAuthenticatedProfile: vi.fn(),
}));

vi.mock("../auth", () => ({
  authComponent: {
    getAuthUser: vi.fn(),
  },
}));

vi.mock("./helpers", () => {
  return {
    toAuctionSummary: vi.fn((_ctx, a) =>
      Promise.resolve({ _id: a._id, title: a.title, status: a.status })
    ),
    AuctionSummaryValidator: v.object({
      _id: v.string(),
      title: v.string(),
      status: v.string(),
    }),
    AuctionDetailValidator: v.any(),
    BidValidator: v.any(),
  };
});

vi.mock("../users", () => ({
  findUserById: vi.fn(),
}));

vi.mock("../admin_utils", () => ({
  countQuery: vi.fn().mockResolvedValue(10),
}));

interface MockQuery {
  withIndex: Mock;
  withSearchIndex: Mock;
  filter: Mock;
  order: Mock;
  take: Mock;
  collect: Mock;
  paginate: Mock;
}

// Ensure mock matches the generic context layout without extending QueryCtx
// since internal types clash. We cast this to QueryCtx when calling handlers.
interface MockQueryCtx {
  db: {
    query: Mock;
    get: Mock;
    system: unknown;
    normalizeId: unknown;
  };
  auth: {
    getUserIdentity: Mock;
  };
  storage: unknown;
}

describe("Queries Extra Coverage", () => {
  let mockCtx: MockQueryCtx;
  let queryMock: MockQuery;

  beforeEach(() => {
    vi.clearAllMocks();
    queryMock = {
      withIndex: vi.fn().mockReturnThis(),
      withSearchIndex: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      collect: vi.fn().mockReturnThis(),
      paginate: vi.fn().mockReturnThis(),
    };
    mockCtx = {
      db: {
        query: vi.fn(() => queryMock),
        get: vi.fn(),
        system: {},
        normalizeId: vi.fn(),
      },
      auth: {
        getUserIdentity: vi.fn(),
      },
      storage: {},
    };
  });

  it("hits line 294: getBaseQuery default branch when statuses.length !== 1", async () => {
    queryMock.paginate.mockResolvedValue({
      page: [],
      isDone: true,
      continueCursor: "",
    });
    await getActiveAuctionsHandler(mockCtx as unknown as QueryCtx, {
      paginationOpts: { numItems: 10, cursor: null },
      statusFilter: "all",
    });
    expect(queryMock.order).toHaveBeenCalledWith("desc");
  });

  it("hits line 341: toAuctionSummary inside search block", async () => {
    queryMock.paginate.mockResolvedValue({
      page: [
        {
          _id: "a1",
          title: "tractor",
          status: "active",
          make: "m",
          model: "m",
          year: 2020,
        },
      ],
      isDone: true,
      continueCursor: "",
    });
    queryMock.take.mockResolvedValue([]);
    const result = await getActiveAuctionsHandler(
      mockCtx as unknown as QueryCtx,
      {
        paginationOpts: { numItems: 10, cursor: null },
        search: "tractor",
      }
    );
    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("tractor");
  });

  it("hits line 369: toAuctionSummary inside standard block", async () => {
    queryMock.paginate.mockResolvedValue({
      page: [
        {
          _id: "a1",
          title: "tractor",
          status: "active",
          make: "m",
          model: "m",
          year: 2020,
        },
      ],
      isDone: true,
      continueCursor: "",
    });
    const result = await getActiveAuctionsHandler(
      mockCtx as unknown as QueryCtx,
      {
        paginationOpts: { numItems: 10, cursor: null },
      }
    );
    expect(result.page).toHaveLength(1);
  });

  it("hits line 543: Anonymous bidder when user not found in getAuctionBidsHandler", async () => {
    queryMock.paginate.mockResolvedValue({
      page: [
        {
          _id: "b1",
          auctionId: "a1",
          bidderId: "user_not_found_123",
          amount: 100,
          timestamp: 100,
        },
      ],
      isDone: true,
      continueCursor: "",
    });
    vi.mocked(mockCtx.db.get).mockResolvedValue({
      sellerId: "seller",
    } as unknown as Doc<"auctions">);
    vi.mocked(auth.getAuthenticatedProfile).mockResolvedValue({
      profile: { role: "admin" },
    } as unknown as Awaited<ReturnType<typeof auth.getAuthenticatedProfile>>);
    vi.mocked(findUserById).mockResolvedValue(null);

    const result = await getAuctionBidsHandler(mockCtx as unknown as QueryCtx, {
      auctionId: "a1" as Id<"auctions">,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result.page[0].bidderName).toBe("Anonymous");
  });

  it("hits lines 976-978: Pagination with valid cursor in getMyBidsHandler", async () => {
    vi.mocked(authComponent.getAuthUser).mockResolvedValue({
      _id: "u1",
      userId: "u1",
      name: "u1",
    } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
    vi.mocked(auth.resolveUserId).mockReturnValue("u1");

    // mock bids and auctions to have something to paginate
    queryMock.collect.mockResolvedValue([
      { auctionId: "a1", amount: 100, bidderId: "u1", timestamp: 100 },
      { auctionId: "a2", amount: 200, bidderId: "u1", timestamp: 200 },
    ]);
    vi.mocked(mockCtx.db.get).mockImplementation(async (id: unknown) => {
      return {
        _id: id,
        status: "active",
        currentPrice: id === "a1" ? 100 : 200,
        winnerId: "u1",
        title: id,
      } as unknown as Doc<"auctions">;
    });

    const result = await getMyBidsHandler(mockCtx as unknown as QueryCtx, {
      paginationOpts: { numItems: 1, cursor: "1" },
    });

    expect(result.page).toHaveLength(1);
    expect(result.page[0].title).toBe("a1"); // Since default sort is b.lastBidTimestamp - a.lastBidTimestamp
    expect(result.isDone).toBe(true);
  });

  it("hits lines 976-978: Pagination with out of bounds cursor in getMyBidsHandler", async () => {
    vi.mocked(authComponent.getAuthUser).mockResolvedValue({
      _id: "u1",
      userId: "u1",
      name: "u1",
    } as unknown as Awaited<ReturnType<typeof authComponent.getAuthUser>>);
    vi.mocked(auth.resolveUserId).mockReturnValue("u1");

    queryMock.collect.mockResolvedValue([
      { auctionId: "a1", amount: 100, bidderId: "u1", timestamp: 100 },
    ]);
    vi.mocked(mockCtx.db.get).mockResolvedValue({
      _id: "a1",
      status: "active",
      currentPrice: 100,
      winnerId: "u1",
      title: "a1",
    } as unknown as Doc<"auctions">);

    const result = await getMyBidsHandler(mockCtx as unknown as QueryCtx, {
      paginationOpts: { numItems: 1, cursor: "100" },
    });

    expect(result.page).toHaveLength(0);
    expect(result.isDone).toBe(true);
  });
});
