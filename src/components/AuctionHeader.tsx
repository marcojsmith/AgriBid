// app/src/components/AuctionHeader.tsx
import { useState } from "react";
import { MapPin, Calendar, HardDrive, Heart, Gavel } from "lucide-react";
import type { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { UNCATEGORIZED_LABEL } from "@/lib/constants";
import { cn, isValidCallbackUrl } from "@/lib/utils";

import { Button } from "./ui/button";

interface AuctionHeaderProps {
  auction: Doc<"auctions"> & { categoryName?: string };
}

/**
 * Component for rendering the header of an auction listing.
 *
 * @param props - Component props
 * @param props.auction - The auction document
 * @returns The rendered auction header
 */
export const AuctionHeader = ({ auction }: AuctionHeaderProps) => {
  const { data: session, isPending: sessionIsPending } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isWatched = useQuery(api.watchlist.isWatched, {
    auctionId: auction._id,
  });
  const toggleWatchlist = useMutation(api.watchlist.toggleWatchlist);
  const [isToggling, setIsToggling] = useState(false);

  const isWinner =
    !!session?.user.id &&
    !!auction.winnerId &&
    session.user.id === auction.winnerId;
  const isSeller = !!session?.user.id && session.user.id === auction.sellerId;

  const handleWatchlistToggle = async () => {
    if (sessionIsPending || isWatched === undefined || isToggling) return;

    if (!session) {
      toast.info("Please sign in to watch an auction");
      const rawUrl = `${location.pathname}${location.search}${location.hash}`;
      const callbackUrl = isValidCallbackUrl(rawUrl)
        ? encodeURIComponent(rawUrl)
        : "/";
      void navigate(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    setIsToggling(true);
    try {
      const nowWatched = await toggleWatchlist({ auctionId: auction._id });
      toast.success(
        nowWatched ? "Added to watchlist" : "Removed from watchlist"
      );
    } catch {
      toast.error("Failed to update watchlist");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Badge
          variant="outline"
          className="font-medium bg-primary/5 text-primary border-primary/20 text-[10px]"
        >
          {/* Intentionally `||` not `??`: an empty string category name also means "no category" */}
          {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- see comment above */}
          {auction.categoryName || UNCATEGORIZED_LABEL}
        </Badge>
        <Badge variant="secondary" className="font-medium">
          {auction.year} {auction.make}
        </Badge>
        <Badge
          variant="outline"
          className="font-semibold text-muted-foreground text-[10px]"
        >
          ID: {auction._id.toString().slice(-8)}
        </Badge>
        {auction.status === "sold" && (
          <Badge className="bg-success hover:bg-success/90 text-success-foreground font-semibold px-3 py-1">
            {isWinner ? "You won" : "Sold"}
          </Badge>
        )}
        {auction.status === "unsold" && (
          <Badge variant="destructive" className="font-semibold px-3 py-1">
            Unsold
          </Badge>
        )}
      </div>

      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-snug">
            {auction.title}
          </h1>
          {auction.make && auction.model && (
            <p className="text-sm font-medium text-muted-foreground">
              {auction.year} {auction.make} {auction.model}
            </p>
          )}
        </div>
        {auction.status === "active" && (
          <Button
            variant="outline"
            size="lg"
            className={cn(
              "rounded-md border font-medium text-xs gap-2 h-12 px-6 transition-all shrink-0",
              isWatched
                ? "border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                : "text-zinc-500 hover:border-primary hover:text-primary"
            )}
            onClick={handleWatchlistToggle}
            disabled={sessionIsPending || isWatched === undefined || isToggling}
          >
            <Heart className={cn("h-4 w-4", isWatched && "fill-current")} />
            {isWatched ? "Watching" : "Watch"}
          </Button>
        )}
      </div>

      {isWinner && (
        <div className="bg-success/10 border border-success/20 text-success p-4 rounded-md flex items-center gap-3 animate-in fade-in zoom-in-95 duration-500">
          <div className="h-10 w-10 rounded-full bg-success flex items-center justify-center text-success-foreground shrink-0">
            <Heart className="h-5 w-5 fill-current" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">
              Congratulations!
            </p>
            <p className="text-xs font-medium opacity-80 mt-0.5">
              You are the winning bidder for this equipment.
            </p>
          </div>
        </div>
      )}

      {!isWinner && isSeller && auction.status === "sold" && (
        <div className="bg-primary/10 border border-primary/20 text-primary-foreground p-4 rounded-md flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
            <Gavel className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight text-primary">
              Item Sold
            </p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Reserve met. Transaction finalization in progress.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-6 text-muted-foreground pt-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary/60" />
          <span className="font-medium text-foreground">
            {auction.location}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary/60" />
          <span className="font-medium text-foreground">
            {auction.operatingHours.toLocaleString()} Operating Hours
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary/60" />
          <span className="font-medium text-foreground">
            Year {auction.year}
          </span>
        </div>
      </div>
    </div>
  );
};
