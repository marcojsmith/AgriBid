import type { FunctionReturnType } from "convex/server";

import type { api } from "../../convex/_generated/api";

/**
 * Full lot detail shape returned by `api.auctions.queries.browse.getLotById`.
 *
 * Derived from the query's return validator rather than hand-rolled fields, so
 * it stays in sync with the backend as the lot shape evolves.
 */
export type LotDetail = NonNullable<
  FunctionReturnType<typeof api.auctions.queries.browse.getLotById>
>;

/**
 * Compact lot summary shape used in list and grid views.
 *
 * Derived from the `getActiveAuctions` paginated page so it matches what list
 * queries actually return.
 */
export type LotSummary = FunctionReturnType<
  typeof api.auctions.queries.browse.getActiveAuctions
>["page"][number];

/**
 * @deprecated Use {@link LotSummary}. Kept as an alias so out-of-scope call
 * sites that still import this name continue to typecheck.
 */
export type AuctionWithCategory = LotSummary;

/**
 * @deprecated Use {@link LotSummary}.
 */
export type AuctionSummary = LotSummary;

/**
 * Represents the images associated with an auction.
 */
export interface AuctionImages {
  /** Front view image storage ID or URL */
  front?: string;
  /** Engine bay image storage ID or URL */
  engine?: string;
  /** Cabin/instrument cluster image storage ID or URL */
  cabin?: string;
  /** Rear/hitch image storage ID or URL */
  rear?: string;
  /** Additional photos array */
  additional?: string[];
}
