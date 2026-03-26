import { describe, it, expect } from "vitest";

import * as queries from "./queries";

describe("Auctions Queries Re-exports", () => {
  it("should export selected query handlers from sub-modules", () => {
    expect(queries).toBeDefined();
    expect(queries.moduleName).toBe("auctions/queries");
    // Verify some expected exports from various sub-modules
    expect(queries.getAuctionById).toBeDefined();
    expect(queries.getMyBids).toBeDefined();
    expect(queries.getPendingAuctions).toBeDefined();
    expect(queries.getMyListings).toBeDefined();
    expect(queries.getActiveAuctions).toBeDefined();
    expect(queries.getAllAuctions).toBeDefined();
    expect(queries.getCategories).toBeDefined();
  });
});

/**
 * Behavioral test coverage for these queries is implemented in:
 * - convex/auctions/queries/admin.test.ts (getPendingAuctions, getAllAuctions, getCategories, and other admin queries)
 * - convex/auctions/queries/browse.test.ts (getAuctionById, getActiveAuctions)
 * - convex/auctions/queries/bids.test.ts (getMyBids)
 * - convex/auctions/queries/listings.test.ts (getMyListings)
 */