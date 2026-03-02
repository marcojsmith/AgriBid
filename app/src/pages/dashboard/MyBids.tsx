// app/src/pages/dashboard/MyBids.tsx
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gavel, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingIndicator } from "@/components/LoadingIndicator";

interface StatusDisplay {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}

interface AuctionWithBid {
  status: string;
  isWon?: boolean;
  isWinning?: boolean;
}

/**
 * Determine the user-facing badge label and visual variant for an auction's bid status.
 *
 * @param auction - Auction data that includes `status`, and optional `isWon` / `isWinning` flags
 * @returns A StatusDisplay object with `label` (badge text) and `variant` (badge style). Possible labels include `WON`, `WINNING`, `RESERVE NOT MET`, `OUTBID / SOLD`, or the auction's `status` uppercased.
 */
function getStatusDisplay(auction: AuctionWithBid): StatusDisplay {
  const isWon = auction.isWon;
  const isWinning = auction.isWinning;
  const isLost =
    (auction.status === "sold" && !isWon) || auction.status === "unsold";

  if (isWon) return { label: "WON", variant: "default" };
  if (isWinning) return { label: "WINNING", variant: "secondary" };
  if (auction.status === "unsold")
    return { label: "RESERVE NOT MET", variant: "destructive" };
  if (isLost) return { label: "OUTBID / SOLD", variant: "destructive" };

  return {
    label: auction.status.toUpperCase(),
    variant: "outline",
  };
}

/**
 * Render the current user's "My Bids" dashboard, showing a loading indicator while bids are fetched, an empty-state call-to-action when no bids exist, or a responsive grid of bid cards with status badges, bid amounts, and links to each auction.
 *
 * @returns The React element for the My Bids dashboard page
 */
export default function MyBids() {
  const {
    results: auctions,
    status,
    loadMore,
  } = usePaginatedQuery(api.auctions.getMyBids, {}, { initialNumItems: 12 });

  const totalBids = useQuery(api.auctions.getMyBidsCount);

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Gavel className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-primary uppercase">
          My Bids
        </h1>
      </div>

      {auctions.length === 0 ? (
        <div className="max-w-4xl mx-auto space-y-8 py-24 text-center bg-card border-2 border-dashed rounded-3xl border-primary/10">
          <p className="text-muted-foreground text-lg max-w-md mx-auto font-bold uppercase tracking-widest">
            You haven't placed any bids yet.
          </p>
          <Button
            size="lg"
            className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20"
            asChild
          >
            <Link to="/">Browse Auctions</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {auctions.map((auction) => {
              const { label, variant } = getStatusDisplay(auction);

              return (
                <div
                  key={`${auction._id}-${auction.bidTimestamp}`}
                  className="bg-card border-2 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="aspect-video bg-muted relative">
                    {auction.images.front && (
                      <img
                        src={auction.images.front}
                        alt={auction.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={variant}
                        className={cn(
                          "font-bold uppercase tracking-wider",
                          auction.isWon && "bg-green-600 hover:bg-green-700"
                        )}
                      >
                        {label}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <h3 className="font-bold text-lg leading-tight line-clamp-2">
                      {auction.title}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black">
                          My Bid
                        </p>
                        <p className="font-bold">
                          R{" "}
                          {(
                            auction.bidAmount ?? auction.myHighestBid
                          ).toLocaleString("en-ZA")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-black">
                          Current Price
                        </p>
                        <p className="font-bold text-primary">
                          R {auction.currentPrice.toLocaleString("en-ZA")}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="w-full font-bold"
                      variant="outline"
                      asChild
                    >
                      <Link to={`/auction/${auction._id}`}>
                        {auction.status === "active"
                          ? "View Auction"
                          : "View Results"}
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-4 pt-8">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">
              Showing {auctions.length} of {totalBids ?? auctions.length} Bids
            </p>
            {status === "CanLoadMore" ? (
              <Button
                variant="outline"
                onClick={() => loadMore(10)}
                className="font-bold min-w-[200px]"
              >
                Load More Bids
              </Button>
            ) : status === "LoadingMore" ? (
              <Button disabled variant="outline" className="min-w-[200px]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
