import { describe, it, expect, vi } from "vitest";

import * as queries from "./queries";

describe("Auctions Queries Re-exports", () => {
  it("should export selected query handlers from sub-modules", () => {
    expect(queries).toBeDefined();
    expect(queries.moduleName).toBe("auctions/queries");
    // Verify some expected exports from various sub-modules
    expect(queries.getLotById).toBeDefined();
    expect(queries.getMyBids).toBeDefined();
    expect(queries.getPendingLots).toBeDefined();
    expect(queries.getMyListings).toBeDefined();
    expect(queries.getActiveLots).toBeDefined();
    expect(queries.getAllLots).toBeDefined();
    expect(queries.getCategories).toBeDefined();
  });

  it("should have functional handlers that can be called", async () => {
    // This is a smoke test to ensure the re-exported handlers are actually functional
    // We mock the context and check if the handler executes
    const mockCtx = {
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnThis(),
          withSearchIndex: vi.fn().mockReturnThis(),
          filter: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          take: vi.fn().mockResolvedValue([]),
          collect: vi.fn().mockResolvedValue([]),
          paginate: vi.fn().mockResolvedValue({
            page: [],
            isDone: true,
            continueCursor: "",
          }),
        }),
      },
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "user1" }),
      },
    };

    // Call one of the handlers to prove it's connected
    const result = await (
      queries as unknown as {
        getActiveLotsHandler: (
          ctx: unknown,
          args: {
            paginationOpts: { numItems: number; cursor: string | null };
          }
        ) => Promise<unknown>;
      }
    ).getActiveLotsHandler(mockCtx, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(result).toBeDefined();
  });
});

/**
 * Behavioral test coverage for these queries is implemented in:
 * - convex/auctions/queries/admin.test.ts (getPendingLots, getAllLots, getCategories, and other admin queries)
 * - convex/auctions/queries/browse.test.ts (getLotById, getActiveLots)
 * - convex/auctions/queries/bids.test.ts (getMyBids)
 * - convex/auctions/queries/listings.test.ts (getMyListings)
 */
