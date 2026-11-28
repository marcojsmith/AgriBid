import type { FunctionReturnType } from "convex/server";
import type { api } from "convex/_generated/api";

/** The My bids overview: Bidding and Lost rows and the tab counts. */
export type MyBidsOverview = FunctionReturnType<
  typeof api.auctions.queries.getMyBidsOverview
>;

/** One lot in the Bidding or Lost tab, with the caller's position. */
export type MyBidRow = MyBidsOverview["bidding"][number];

/** One won lot with its payment. */
export type WonLotRow = FunctionReturnType<
  typeof api.lotPayments.getMyWonLots
>["page"][number];

/** A lot in the Watching tab. */
export type WatchedLot = FunctionReturnType<
  typeof api.watchlist.getWatchedLots
>["page"][number];
