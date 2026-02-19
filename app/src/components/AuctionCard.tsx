// app/src/components/AuctionCard.tsx
import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useSession } from "../lib/auth-client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { BidConfirmation } from "./BidConfirmation";
import { isValidCallbackUrl, cn } from "@/lib/utils";
import { AuctionCardThumbnail } from "./auction/AuctionCardThumbnail";
import { AuctionCardPrice } from "./auction/AuctionCardPrice";

interface AuctionCardProps {
  auction: Doc<"auctions">;
  viewMode?: "compact" | "detailed";
}

export const AuctionCard = ({
  auction,
  viewMode = "detailed",
}: AuctionCardProps) => {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const placeBid = useMutation(api.auctions.placeBid);
  const isWatched = useQuery(api.watchlist.isWatched, {
    auctionId: auction._id,
  });
  const toggleWatchlist = useMutation(api.watchlist.toggleWatchlist);
  const [isBidding, setIsBidding] = useState(false);
  const isBiddingRef = useRef(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingBid, setPendingBid] = useState<number | null>(null);

  const handleWatchlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      toast.info("Please sign in to watch an auction");
      const rawUrl = `/auction/${auction._id}`;
      const callbackUrl = isValidCallbackUrl(rawUrl)
        ? encodeURIComponent(rawUrl)
        : "/";
      navigate(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    try {
      const nowWatched = await toggleWatchlist({ auctionId: auction._id });
      toast.success(
        nowWatched ? "Added to watchlist" : "Removed from watchlist",
      );
    } catch {
      toast.error("Failed to update watchlist");
    }
  };

  const handleBidInitiate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      toast.info("Please sign in to place a bid");
      const rawUrl = `/auction/${auction._id}`;
      const callbackUrl = isValidCallbackUrl(rawUrl)
        ? encodeURIComponent(rawUrl)
        : "/";
      navigate(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    const amount = auction.currentPrice + auction.minIncrement;
    setPendingBid(amount);
    setIsConfirmOpen(true);
  };

  const handleBidConfirm = async () => {
    if (pendingBid === null || isBiddingRef.current) return;

    const minimum = auction.currentPrice + auction.minIncrement;
    if (pendingBid < minimum) {
      toast.error(
        `Price updated to R ${minimum.toLocaleString("en-ZA")} due to a newer bid.`,
      );
      setPendingBid(minimum);
      return;
    }

    isBiddingRef.current = true;
    setIsConfirmOpen(false);
    setIsBidding(true);
    try {
      await placeBid({ auctionId: auction._id, amount: pendingBid });
      toast.success("Bid placed successfully!");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to place bid",
      );
    } finally {
      setIsBidding(false);
      isBiddingRef.current = false;
      setPendingBid(null);
    }
  };

  const images = auction.images;
  const primaryImage = Array.isArray(images)
    ? images[0]
    : images.front ||
      images.engine ||
      images.cabin ||
      images.rear ||
      images.additional?.[0];

  const isCompact = viewMode === "compact";

  return (
    <Card
      className={cn(
        "overflow-hidden border-2 hover:border-primary transition-colors bg-card group rounded-lg h-full shadow-none",
      )}
    >
      <Link
        to={`/auction/${auction._id}`}
        className={cn("flex h-full", isCompact ? "flex-row" : "flex-col")}
      >
        <AuctionCardThumbnail
          primaryImage={primaryImage}
          title={auction.title}
          isCompact={isCompact}
          isWatched={isWatched}
          onWatchlistToggle={handleWatchlistToggle}
          year={auction.year}
          make={auction.make}
          endTime={auction.endTime}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <CardHeader
            className={cn(isCompact ? "p-3 pb-1" : "p-4 md:p-5 pb-0 md:pb-0")}
          >
            <div className="flex justify-between items-start gap-2">
              <CardTitle
                className={cn(
                  "leading-tight font-black group-hover:text-primary transition-colors line-clamp-2 uppercase tracking-tight",
                  isCompact
                    ? "text-xs sm:text-sm md:text-base"
                    : "text-lg md:text-xl",
                )}
              >
                {auction.title}
              </CardTitle>
            </div>

            {isCompact ? (
              <p className="text-[10px] sm:text-xs leading-tight text-muted-foreground font-medium line-clamp-3 mt-1.5 italic">
                {auction.description}
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-muted-foreground font-bold text-sm">
                <div className="flex items-center gap-1">
                  <MapPin className="text-primary/60 h-4 w-4" />
                  <span className="truncate">{auction.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="text-primary/60 h-4 w-4" />
                  <span>{auction.operatingHours.toLocaleString()} hrs</span>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent
            className={cn(
              "flex-1 flex flex-col justify-end pt-0 md:pt-0",
              isCompact ? "p-3" : "p-4 md:p-5",
            )}
          >
            <AuctionCardPrice
              currentPrice={auction.currentPrice}
              endTime={auction.endTime}
              isCompact={isCompact}
            />
          </CardContent>

          <div
            className={cn(
              "bg-muted/20 border-t flex gap-2 items-center",
              isCompact ? "p-3 h-12" : "p-4 md:p-5",
            )}
          >
            <Button
              size="sm"
              className={cn(
                "flex-1 font-black uppercase shadow-sm",
                isCompact
                  ? "text-[10px] h-8 rounded-lg"
                  : "text-xs h-11 rounded-xl",
              )}
              onClick={handleBidInitiate}
              disabled={isBidding || auction.status !== "active"}
            >
              {isBidding
                ? "..."
                : `Bid R ${(auction.currentPrice + auction.minIncrement).toLocaleString("en-ZA")}`}
            </Button>
          </div>
        </div>
      </Link>

      <BidConfirmation
        isOpen={isConfirmOpen}
        amount={pendingBid || 0}
        onConfirm={handleBidConfirm}
        onCancel={() => {
          setIsConfirmOpen(false);
          setPendingBid(null);
        }}
      />
    </Card>
  );
};
