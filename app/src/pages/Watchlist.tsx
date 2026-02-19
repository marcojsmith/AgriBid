// app/src/pages/Watchlist.tsx
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "../components/ui/button";
import { Heart } from "lucide-react";
import { AuctionCard } from "../components/AuctionCard";

/**
 * Render the user's watchlist page.
 *
 * Displays a loading spinner while watched auctions are being fetched. If the user is not watching any auctions, shows an empty state with an "Explore Marketplace" action; otherwise renders a responsive grid of AuctionCard components for each watched auction.
 *
 * @returns The watchlist page JSX element
 */
export default function Watchlist() {
  const watchedAuctions = useQuery(api.watchlist.getWatchedAuctions);

  if (watchedAuctions === undefined) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Heart className="h-6 w-6 text-primary fill-current" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-primary uppercase">
          My Watchlist
        </h1>
      </div>

      {watchedAuctions.length === 0 ? (
        <div className="max-w-4xl mx-auto space-y-8 py-24 text-center bg-card border-2 border-dashed rounded-3xl border-primary/10">
          <div className="space-y-3">
            <p className="text-muted-foreground text-lg max-w-md mx-auto font-bold uppercase tracking-widest">
              You are not watching any auctions yet.
            </p>
          </div>
          <Button
            size="lg"
            className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20"
            asChild
          >
            <Link to="/">Explore Marketplace</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {watchedAuctions.map((auction) => (
            <AuctionCard key={auction._id} auction={auction} />
          ))}
        </div>
      )}
    </div>
  );
}
