import { useParams, Link } from "react-router-dom";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ArrowLeft, Gavel, Award } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { AuctionCard } from "@/components/auction/AuctionCard";
import {
  PAGINATION_INITIAL_ITEMS,
  PAGINATION_LOAD_MORE_ITEMS,
} from "@/lib/constants";

type ListingStatus = "active" | "sold";

interface SellerListingsProps {
  /** Which slice of the seller's listings to show: active auctions or past sales. */
  status: ListingStatus;
}

/**
 * Renders a paginated grid of a seller's auctions filtered by status, used by the
 * "View all" links on the profile page.
 *
 * Shows the seller's name in the page title (falling back to "this seller" while
 * loading or when unavailable), a back link to the seller's profile, watch-state-aware
 * auction cards, an empty state when no listings match the filter, and a "Load More"
 * pagination control.
 *
 * @param root0 - Component props
 * @param root0.status - Which listings to display: "active" for active auctions or "sold" for past sales
 * @returns A React element containing the filtered seller listings grid
 */
export default function SellerListings({ status }: SellerListingsProps) {
  const { userId } = useParams<{ userId: string }>();
  const isActive = status === "active";

  const sellerInfo = useQuery(api.auctions.getSellerInfo, {
    sellerId: userId ?? "",
  });

  const watchedAuctionIds = useQuery(api.watchlist.getWatchedAuctionIds, {});

  const {
    results: listings,
    status: listingsStatus,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getSellerListings,
    { userId: userId ?? "", statusFilter: status },
    { initialNumItems: PAGINATION_INITIAL_ITEMS }
  );

  if (listingsStatus === "LoadingFirstPage") {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <LoadingIndicator />
      </div>
    );
  }

  const sellerName = sellerInfo?.name ?? "this seller";

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 py-4 sm:p-6">
      <div className="space-y-4">
        <Button asChild variant="outline" className="rounded-md border-2">
          <Link to={`/profile/${userId ?? ""}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to profile
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {isActive ? (
            <Gavel className="h-5 w-5 text-primary" />
          ) : (
            <Award className="h-5 w-5 text-green-600" />
          )}
          <h1
            className={`text-2xl sm:text-4xl font-black uppercase tracking-tight ${
              isActive ? "text-primary" : "text-green-700"
            }`}
          >
            {isActive ? "Active Auctions" : "Past Sales"} by {sellerName}
          </h1>
        </div>
      </div>

      {listings.length === 0 && listingsStatus === "Exhausted" ? (
        <div className="border-2 border-dashed border-border rounded p-12 text-center">
          <p className="text-4xl mb-3">🚜</p>
          <p className="text-muted-foreground font-bold uppercase tracking-widest italic text-sm">
            {isActive
              ? "No active auctions at this time."
              : "No past sales at this time."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listings.map((auction) => (
              <AuctionCard
                key={auction._id}
                auction={auction}
                isWatched={watchedAuctionIds?.includes(auction._id) ?? false}
              />
            ))}
          </div>

          {(listingsStatus === "CanLoadMore" ||
            listingsStatus === "LoadingMore") && (
            <div className="flex flex-col items-center gap-4 pt-4 pb-8">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">
                Showing {listings.length} Listings
              </p>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  loadMore(PAGINATION_LOAD_MORE_ITEMS);
                }}
                disabled={listingsStatus === "LoadingMore"}
                className="rounded-md border-2 px-12 font-black uppercase tracking-widest"
              >
                {listingsStatus === "LoadingMore" ? (
                  <>
                    <LoadingIndicator size="sm" className="mr-2" />
                    Loading...
                  </>
                ) : (
                  "Load More Listings"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
