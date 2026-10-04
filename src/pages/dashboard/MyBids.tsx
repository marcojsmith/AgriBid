// app/src/pages/dashboard/MyBids.tsx
import { useState, useMemo } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { Gavel, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardListSkeleton } from "@/components/DashboardListSkeleton";
import { BidCard } from "@/components/dashboard/BidCard";
import { BidFilters } from "@/components/dashboard/BidFilters";
import { BidStats } from "@/components/dashboard/BidStats";
import {
  isMyBidAuction,
  type MyBidsStats,
} from "@/components/dashboard/bidTypes";
import {
  DASHBOARD_PAGINATION_INITIAL_ITEMS,
  DASHBOARD_PAGINATION_LOAD_MORE_ITEMS,
} from "@/lib/constants";

/** Stable placeholder shown while the stats query has not resolved. */
const EMPTY_STATS: MyBidsStats = {
  totalActive: 0,
  winningCount: 0,
  outbidCount: 0,
  totalExposure: 0,
};

/**
 * Renders the user's personal bidding dashboard.
 * @returns The MyBids page component
 */
export default function MyBids() {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("ending");

  const serverStats = useQuery(api.auctions.queries.getMyBidsStats);

  const {
    results: rawAuctions,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.queries.getMyBids,
    { sort: sortBy === "ending" ? "ending" : undefined },
    { initialNumItems: DASHBOARD_PAGINATION_INITIAL_ITEMS }
  );

  const stats = serverStats ?? EMPTY_STATS;

  // Apply filtering and sorting
  const filteredAndSortedAuctions = useMemo(() => {
    let result = rawAuctions.filter(isMyBidAuction);

    // Filter
    if (filter === "winning") {
      result = result.filter((a) => a.isWinning && a.status === "assigned");
    } else if (filter === "outbid") {
      result = result.filter((a) => a.isOutbid && a.status === "assigned");
    } else if (filter === "ended") {
      result = result.filter(
        (a) => a.status === "sold" || a.status === "unsold"
      );
    }

    // Sort
    if (sortBy === "recent") {
      result.sort((a, b) => b.lastBidTimestamp - a.lastBidTimestamp);
    } else if (sortBy === "bid") {
      result.sort((a, b) => b.myHighestBid - a.myHighestBid);
    }

    return result;
  }, [rawAuctions, filter, sortBy]);

  const totalBids = useQuery(api.auctions.getMyBidsCount);

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <DashboardListSkeleton variant="bids" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Gavel className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary">
            My Bids
          </h1>
        </div>
      </div>

      {rawAuctions.length > 0 && <BidStats stats={stats} />}

      {rawAuctions.length === 0 ? (
        <div className="max-w-4xl mx-auto space-y-8 py-24 text-center bg-card border border-dashed rounded-lg border-primary/10">
          <p className="text-muted-foreground text-lg max-w-md mx-auto font-bold">
            You haven’t placed any bids yet.
          </p>
          <Button
            size="lg"
            className="h-14 px-12 rounded-lg font-semibold text-xl shadow-xl shadow-primary/20 transition-[transform,shadow,background-color] hover:scale-105 active:scale-95"
            asChild
          >
            <Link to="/">Browse Auctions</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <BidFilters
            filter={filter}
            onFilterChange={setFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredAndSortedAuctions.map((auction) => (
              <BidCard key={auction._id} auction={auction} />
            ))}
          </div>

          {filteredAndSortedAuctions.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-muted-foreground font-bold">
                No auctions found matching this filter.
              </p>
            </div>
          )}

          <div className="flex flex-col items-center gap-4 pt-8">
            <p className="text-xs font-semibold text-muted-foreground">
              Showing {filteredAndSortedAuctions.length} of{" "}
              {totalBids ?? filteredAndSortedAuctions.length} Auctions
            </p>
            {status === "CanLoadMore" ? (
              <Button
                variant="outline"
                onClick={() => {
                  loadMore(DASHBOARD_PAGINATION_LOAD_MORE_ITEMS);
                }}
                className="h-12 px-10 rounded-md font-semibold border hover:bg-primary hover:text-primary-foreground transition-[background-color,color,border-color]"
              >
                Load More
              </Button>
            ) : status === "LoadingMore" ? (
              <Button
                disabled
                variant="outline"
                className="h-12 px-10 rounded-md border"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
