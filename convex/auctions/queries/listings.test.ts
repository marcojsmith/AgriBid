import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import {
  getMyListingsHandler,
  getMyListingsCountHandler,
  getMyListingsStatsHandler,
} from "./listings";
import { getAuthenticatedUserId } from "./shared";
import type * as sharedModule from "./shared";
import { countQuery } from "../../admin_utils";
import { toLotSummaries } from "../helpers";
import type * as helpersModule from "../helpers";
import type { QueryCtx } from "../../_generated/server";

vi.mock("../../_generated/server", () => ({
  query: vi.fn((q: unknown) => q),
  mutation: vi.fn((m: unknown) => m),
  internalMutation: vi.fn((m: unknown) => m),
}));

vi.mock("./shared", async (importOriginal) => {
  const actual = await importOriginal<typeof sharedModule>();
  return {
    ...actual,
    getAuthenticatedUserId: vi.fn(),
  };
});

vi.mock("../helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof helpersModule>();
  return {
    ...actual,
    toLotSummary: vi.fn(),
    toLotSummaries: vi.fn(),
  };
});

vi.mock("../../admin_utils", () => ({
  countQuery: vi.fn(),
}));

/** Chainable stand-in for the index range Convex hands to `withIndex`. */
interface MockIndexBuilder {
  eq: Mock;
  gte: Mock;
  lte: Mock;
}

interface QueryChain {
  withIndex: Mock;
  filter: Mock;
  collect: Mock;
  paginate: Mock;
  indexBuilder: MockIndexBuilder;
}

interface PaginatedResult {
  page: Record<string, unknown>[];
  isDone: boolean;
  continueCursor: string;
}

/**
 * Builds a chainable mock for `ctx.db.query(...)`. `withIndex` runs the index
 * callback production code supplies so the predicates are actually executed.
 * @param collected - Rows returned by `collect()`.
 * @param paginated - Result returned by `paginate()`.
 * @returns A mock query chain whose methods return themselves.
 */
function makeQueryChain(
  collected: Record<string, unknown>[] = [],
  paginated: PaginatedResult = {
    page: [],
    isDone: true,
    continueCursor: "",
  }
): QueryChain {
  const indexBuilder: MockIndexBuilder = {
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
  };
  indexBuilder.eq.mockReturnValue(indexBuilder);
  indexBuilder.gte.mockReturnValue(indexBuilder);
  indexBuilder.lte.mockReturnValue(indexBuilder);

  const chain = {
    withIndex: vi.fn(),
    filter: vi.fn(),
    collect: vi.fn().mockResolvedValue(collected) as Mock,
    paginate: vi.fn().mockResolvedValue(paginated) as Mock,
    indexBuilder,
  };
  chain.withIndex.mockImplementation(
    (_index: string, cb?: (q: MockIndexBuilder) => unknown) => {
      if (cb) cb(indexBuilder);
      return chain;
    }
  );
  chain.filter.mockReturnValue(chain);
  return chain;
}

/**
 * Builds a query context with a single configurable `lots` query chain.
 * @param chain - The query chain to return from `ctx.db.query`.
 * @returns A mock query context.
 */
function makeCtx(chain: QueryChain): QueryCtx {
  return {
    db: {
      query: vi.fn().mockReturnValue(chain),
    },
  } as unknown as QueryCtx;
}

const paginationOpts = { numItems: 10, cursor: null };

describe("listings queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMyListingsHandler", () => {
    it("maps the page through toLotSummaries and returns the count", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue("seller1");
      vi.mocked(countQuery).mockResolvedValue(1);
      vi.mocked(toLotSummaries).mockResolvedValue([
        {
          _id: "l1",
          title: "Mapped lot",
        },
      ] as never);

      const chain = makeQueryChain([], {
        page: [{ _id: "l1" }],
        isDone: false,
        continueCursor: "cursor-1",
      });
      const result = await getMyListingsHandler(makeCtx(chain), {
        paginationOpts,
      });

      expect(result.totalCount).toBe(1);
      expect(result.page).toHaveLength(1);
      expect(result.page[0]).toMatchObject({ _id: "l1", title: "Mapped lot" });
      expect(toLotSummaries).toHaveBeenCalledWith(expect.anything(), [
        { _id: "l1" },
      ]);
    });

    it("returns an empty page when unauthenticated", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
      const chain = makeQueryChain();

      const result = await getMyListingsHandler(makeCtx(chain), {
        paginationOpts,
      });

      expect(result.page).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(countQuery).not.toHaveBeenCalled();
    });

    it("scopes the page and the total count to the seller index", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue("seller1");
      vi.mocked(countQuery).mockResolvedValue(1);
      vi.mocked(toLotSummaries).mockResolvedValue([] as never);
      const chain = makeQueryChain();

      await getMyListingsHandler(makeCtx(chain), { paginationOpts });

      expect(chain.withIndex).toHaveBeenCalledWith(
        "by_seller",
        expect.any(Function)
      );
      expect(chain.indexBuilder.eq).toHaveBeenCalledWith("sellerId", "seller1");
      expect(chain.paginate).toHaveBeenCalledWith(paginationOpts);
    });
  });

  describe("getMyListingsCountHandler", () => {
    it("maps the UI 'active' filter to the assigned status", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue("seller1");
      vi.mocked(countQuery).mockResolvedValue(2);
      const chain = makeQueryChain();

      const result = await getMyListingsCountHandler(makeCtx(chain), {
        status: "active",
      });

      expect(result).toBe(2);
      expect(countQuery).toHaveBeenCalled();
    });

    it("passes through an explicit status", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue("seller1");
      vi.mocked(countQuery).mockResolvedValue(5);
      const chain = makeQueryChain();

      const result = await getMyListingsCountHandler(makeCtx(chain), {
        status: "sold",
      });

      expect(result).toBe(5);
    });

    it("counts all listings when status is 'all'", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue("seller1");
      vi.mocked(countQuery).mockResolvedValue(7);
      const chain = makeQueryChain();

      const result = await getMyListingsCountHandler(makeCtx(chain), {
        status: "all",
      });

      expect(result).toBe(7);
    });

    it("queries the seller+status index for an explicit status", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue("seller1");
      vi.mocked(countQuery).mockResolvedValue(4);
      const chain = makeQueryChain();

      await getMyListingsCountHandler(makeCtx(chain), { status: "sold" });

      expect(chain.withIndex).toHaveBeenCalledWith(
        "by_seller_status",
        expect.any(Function)
      );
      expect(chain.indexBuilder.eq).toHaveBeenCalledWith("sellerId", "seller1");
      expect(chain.indexBuilder.eq).toHaveBeenCalledWith("status", "sold");
    });

    it("queries the plain seller index when no status is given", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue("seller1");
      vi.mocked(countQuery).mockResolvedValue(4);
      const chain = makeQueryChain();

      await getMyListingsCountHandler(makeCtx(chain), {});

      expect(chain.withIndex).toHaveBeenCalledWith(
        "by_seller",
        expect.any(Function)
      );
      expect(chain.indexBuilder.eq).toHaveBeenCalledWith("sellerId", "seller1");
      expect(chain.indexBuilder.eq).not.toHaveBeenCalledWith(
        "status",
        expect.anything()
      );
    });

    it("returns 0 when unauthenticated", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
      const chain = makeQueryChain();

      const result = await getMyListingsCountHandler(makeCtx(chain), {});

      expect(result).toBe(0);
      expect(countQuery).not.toHaveBeenCalled();
    });
  });

  describe("getMyListingsStatsHandler", () => {
    it("buckets listings by status, combining approved+assigned as active", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue("seller1");
      const chain = makeQueryChain([
        { status: "draft" },
        { status: "pending_review" },
        { status: "approved" },
        { status: "assigned" },
        { status: "sold" },
        { status: "unsold" },
        { status: "rejected" },
        { status: "something_else" },
      ]);

      const result = await getMyListingsStatsHandler(makeCtx(chain));

      expect(result).toEqual({
        all: 8,
        draft: 1,
        pending_review: 1,
        active: 2,
        sold: 1,
        unsold: 1,
        rejected: 1,
      });
    });

    it("returns zeroed stats when unauthenticated", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
      const chain = makeQueryChain();

      const result = await getMyListingsStatsHandler(makeCtx(chain));

      expect(result).toEqual({
        all: 0,
        draft: 0,
        pending_review: 0,
        active: 0,
        sold: 0,
        unsold: 0,
        rejected: 0,
      });
      expect(chain.collect).not.toHaveBeenCalled();
    });

    it("collects every lot belonging to the seller", async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue("seller1");
      const chain = makeQueryChain([{ status: "draft" }]);

      await getMyListingsStatsHandler(makeCtx(chain));

      expect(chain.withIndex).toHaveBeenCalledWith(
        "by_seller",
        expect.any(Function)
      );
      expect(chain.indexBuilder.eq).toHaveBeenCalledWith("sellerId", "seller1");
      expect(chain.collect).toHaveBeenCalled();
    });
  });
});
