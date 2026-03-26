import { describe, it, expect } from "vitest";

import * as queries from "./queries";

describe("Auctions Queries Re-exports", () => {
  it("should export all expected query groups", () => {
    expect(queries).toBeDefined();
    expect(queries.MODULE_NAME).toBe("auctions/queries");
    // Verify some expected exports from various sub-modules
    expect(queries.getAuctionById).toBeDefined();
    expect(queries.getMyBids).toBeDefined();
    expect(queries.getPendingAuctions).toBeDefined();
    expect(queries.getMyListings).toBeDefined();
  });
});

/**
 * Behavioral test coverage for these queries is implemented in:
 * - convex/auctions/queries/admin.test.ts (admin query tests)
 * - convex/auctions/mutations/browse.test.ts (getAuctionById, getPendingAuctions)
 * - convex/auctions/queries/bids.test.ts (getMyBids)
 * - convex/auctions/queries/listings.test.ts (getMyListings)
 */
