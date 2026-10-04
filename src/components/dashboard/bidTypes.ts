import type { FunctionReturnType } from "convex/server";
import type { api } from "convex/_generated/api";

/**
 * A single row of the "My Bids" feed: a lot summary plus the signed-in user's
 * bid on that lot.
 *
 * Derived from the query's return validator rather than hand-rolled fields, so
 * it stays in sync with the backend as the bid feed evolves.
 */
export type MyBidRow = FunctionReturnType<
  typeof api.auctions.queries.getMyBids
>["page"][number];

/**
 * Allowed statuses for a lot.
 * - `draft`: Listing is being created, not yet published.
 * - `pending_review`: Submitted and awaiting admin approval.
 * - `approved`: Approved by an admin, not yet assigned to an auction.
 * - `assigned`: Assigned to an auction and currently open for bidding.
 * - `sold`: Auction ended with a winning bid meeting reserve.
 * - `unsold`: Auction ended without meeting reserve or no bids.
 * - `rejected`: Admin rejected the listing.
 */
export type AuctionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "assigned"
  | "sold"
  | "unsold"
  | "rejected";

/** A {@link MyBidRow} whose `status` is narrowed to a known {@link AuctionStatus}. */
export type MyBidAuction = MyBidRow & { status: AuctionStatus };

/** Every status a lot can have, used to narrow the query's `string` status. */
export const AUCTION_STATUSES: readonly AuctionStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "assigned",
  "sold",
  "unsold",
  "rejected",
];

/**
 * Type guard narrowing a bid-feed row (whose `status` is typed as `string`) to
 * a row with a known {@link AuctionStatus}.
 *
 * @param row - Raw row from the getMyBids query
 * @returns True if the row's status is a known auction status
 */
export function isMyBidAuction(row: MyBidRow): row is MyBidAuction {
  return (AUCTION_STATUSES as readonly string[]).includes(row.status);
}

/** Aggregate bid statistics rendered above the "My Bids" list. */
export type MyBidsStats = FunctionReturnType<
  typeof api.auctions.queries.getMyBidsStats
>;
