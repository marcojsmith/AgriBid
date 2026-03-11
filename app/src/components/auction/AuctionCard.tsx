// app/src/components/auction/AuctionCard.tsx
import React, { useRef, useState, useEffect } from "react";
import type { Doc } from "convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Clock, MapPin, Gavel } from "lucide-react";
import { Link } from "react-router-dom";

import { useSession } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BidConfirmation } from "@/components/BidConfirmation";
import { isValidCallbackUrl, cn, getErrorMessage } from "@/lib/utils";

import { AuctionCardThumbnail } from "./AuctionCardThumbnail";
import { AuctionCardPrice } from "./AuctionCardPrice";

interface AuctionWithCategory extends Doc<"auctions"> {
  categoryName?: string;
}

interface AuctionCardProps {
  auction: AuctionWithCategory;
  viewMode?: "compact" | "detailed";
  isWatched?: boolean;
}

/**
 * Component for rendering a single auction listing card.
 *
 * @param props - Component props
 * @param props.auction - The auction document
 * @param props.viewMode - Visual mode (compact or detailed)
 * @param props.isWatched - Whether the auction is on the user's watchlist
 * @returns The rendered auction card
 */
export const AuctionCard = ({
  auction,
  viewMode = "detailed",
  isWatched: initialIsWatched = false,
}: AuctionCardProps) => {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const placeBid = useMutation(api.auctions.placeBid);
  const toggleWatchlist = useMutation(api.watchlist.toggleWatchlist);
  const [isBidding, setIsBidding] = useState(false);
  const isBiddingRef = useRef(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  // Track local state for watchlist to provide immediate feedback
  const [isWatched, setIsWatched] = useState(initialIsWatched);

  // Synchronize local state with prop changes from parent (server updates)
  useEffect(() => {
    setIsWatched(initialIsWatched);
  }, [initialIsWatched]);

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
      setIsWatched(nowWatched);
      toast.success(
        nowWatched ? "Added to watchlist" : "Removed from watchlist"
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
        `Price updated to R ${minimum.toLocaleString("en-ZA")} due to a newer bid.`
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
      toast.error(getErrorMessage(error, "Failed to place bid"));
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
  /**
   * Whether the auction is closed (sold or unsold).
   * This flag controls closed-state rendering branches in AuctionCard.
   * It is true when auction.status === "sold" or "unsold".
   */
  const isClosed = auction.status === "sold" || auction.status === "unsold";

  return (
    <Card
      className={cn(
        "overflow-hidden border-2 hover:border-primary transition-colors bg-card group rounded-lg h-full shadow-none"
      )}
    >
      <div className="relative">
        <Link
          to={`/auction/${auction._id}`}
          className={cn("flex h-full", isCompact ? "flex-row" : "flex-col")}
        >
          <div className="relative shrink-0">
            <AuctionCardThumbnail
              primaryImage={primaryImage}
              title={auction.title}
              isCompact={isCompact}
              isWatched={isWatched}
              onWatchlistToggle={handleWatchlistToggle}
              endTime={auction.endTime}
              isClosed={isClosed}
            />
            {isClosed && isCompact && (
              <div className="absolute top-1.5 right-1.5 z-10">
                <div
                  className={cn(
                    "rounded-full flex items-center justify-center shadow-lg",
                    auction.status === "sold"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-destructive text-destructive-foreground",
                    "h-6 w-6"
                  )}
                  role="img"
                  aria-label={
                    auction.status === "sold"
                      ? "Sold auction"
                      : "Closed auction"
                  }
                >
                  <Gavel className="h-3.5 w-3.5" />
                </div>
              </div>
            )}
          </div>

          {isClosed && !isCompact && (
            <div className="absolute top-3 right-3 z-10">
              <Badge
                variant={
                  auction.status === "sold" ? "secondary" : "destructive"
                }
                className="font-black uppercase tracking-wider shadow-lg"
              >
                {auction.status === "sold" ? "SOLD" : "UNSOLD"}
              </Badge>
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <CardHeader
              className={cn(isCompact ? "p-3 pb-1" : "p-4 md:p-5 pb-0 md:pb-0")}
            >
              <div className="flex flex-wrap gap-1 mb-1">
                <Badge
                  variant="outline"
                  className="text-[8px] h-4 py-0 px-1 border-primary/20 text-primary bg-primary/5 uppercase font-bold"
                >
                  {auction.categoryName || "Equipment"}
                </Badge>
              </div>
              <div className="flex justify-between items-start gap-2">
                <CardTitle
                  className={cn(
                    "leading-tight font-black group-hover:text-primary transition-colors line-clamp-2 uppercase tracking-tight",
                    isCompact
                      ? "text-xs sm:text-sm md:text-base"
                      : "text-lg md:text-xl"
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
                isCompact ? "p-3" : "p-4 md:p-5"
              )}
            >
              <AuctionCardPrice
                currentPrice={auction.currentPrice}
                endTime={auction.endTime}
                isCompact={isCompact}
                isClosed={isClosed}
              />
            </CardContent>
          </div>
        </Link>

        <div
          className={cn(
            "bg-muted/20 border-t flex gap-2 items-center",
            isCompact ? "p-3 h-12" : "p-4 md:p-5"
          )}
        >
          <Button
            size="sm"
            className={cn(
              "flex-1 font-black uppercase shadow-sm",
              isCompact
                ? "text-[10px] h-8 rounded-lg"
                : "text-xs h-11 rounded-xl"
            )}
            onClick={handleBidInitiate}
            disabled={isBidding || auction.status !== "active"}
          >
            {isBidding
              ? "..."
              : isClosed
                ? "Closed"
                : `Bid R ${(auction.currentPrice + auction.minIncrement).toLocaleString("en-ZA")}`}
          </Button>
        </div>
      </div>

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
