// app/src/components/auction/AuctionCard.tsx
import React, { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Clock, MapPin, Gavel, CalendarClock } from "lucide-react";

import { useSession } from "@/lib/auth-client";
import { getLotLiveWindow, useLotLiveWindow } from "@/hooks/useLotLiveWindow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BidConfirmation } from "@/components/BidConfirmation";
import { formatCurrency } from "@/lib/currency";
import { isValidCallbackUrl, cn, getErrorMessage } from "@/lib/utils";
import type { LotSummary } from "@/types/auction";

import { AuctionCardThumbnail } from "./AuctionCardThumbnail";
import { AuctionCardPrice } from "./AuctionCardPrice";

interface AuctionCardProps {
  auction: LotSummary;
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
  const placeBid = useMutation(api.auctions.mutations.bidding.placeBid);
  const toggleWatchlist = useMutation(api.watchlist.toggleWatchlist);
  const [isBidding, setIsBidding] = useState(false);
  const isBiddingRef = useRef(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const liveWindow = useLotLiveWindow(auction);

  const prevInitialIsWatchedRef = useRef(initialIsWatched);
  if (prevInitialIsWatchedRef.current !== initialIsWatched) {
    prevInitialIsWatchedRef.current = initialIsWatched;
    setIsWatched(initialIsWatched);
  }

  const handleWatchlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      toast.info("Please sign in to watch an auction");
      const rawUrl = `/auction/${auction._id}`;
      const callbackUrl = isValidCallbackUrl(rawUrl)
        ? encodeURIComponent(rawUrl)
        : "/";
      void navigate(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    try {
      const nowWatched = await toggleWatchlist({ lotId: auction._id });
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

    const window = getLotLiveWindow(auction, Date.now());
    if (window.isUpcoming) {
      toast.error("This auction has not started yet");
      return;
    }

    if (!window.isLive) {
      toast.error("This auction is not open for bidding");
      return;
    }

    if (!session) {
      toast.info("Please sign in to place a bid");
      const rawUrl = `/auction/${auction._id}`;
      const callbackUrl = isValidCallbackUrl(rawUrl)
        ? encodeURIComponent(rawUrl)
        : "/";
      void navigate(`/login?callbackUrl=${callbackUrl}`);
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
        `Price updated to ${formatCurrency(minimum)} due to a newer bid.`
      );
      setPendingBid(minimum);
      return;
    }

    isBiddingRef.current = true;
    setIsConfirmOpen(false);
    setIsBidding(true);
    try {
      await placeBid({ lotId: auction._id, amount: pendingBid });
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

  const { images } = auction;
  const primaryImage =
    images.front ??
    images.engine ??
    images.cabin ??
    images.rear ??
    images.additional[0];

  const isCompact = viewMode === "compact";
  /**
   * Whether the lot is closed (sold, unsold, rejected, or its auction window
   * has passed). Controls closed-state rendering branches in AuctionCard.
   */
  const isClosed = liveWindow.isEnded;
  /**
   * Whether the lot is assigned to a published auction that hasn't started
   * yet — bidding is blocked server-side until then, so the card must make
   * this distinguishable from a live, biddable lot. `useLotLiveWindow`
   * self-updates as the window boundaries pass.
   */
  const isNotStarted = liveWindow.isUpcoming;
  const isUnavailable = liveWindow.isUnavailable;

  return (
    <Card
      className={cn(
        "overflow-hidden border hover:border-primary/60 transition-shadow duration-200 hover:shadow-md bg-card group rounded-lg h-full shadow-none"
      )}
    >
      <div className="relative flex h-full flex-col">
        <Link
          to={`/auction/${auction._id}`}
          className={cn("flex flex-1", isCompact ? "flex-row" : "flex-col")}
        >
          <div className="relative shrink-0 self-stretch">
            <AuctionCardThumbnail
              primaryImage={primaryImage}
              title={auction.title}
              make={auction.make}
              model={auction.model}
              isCompact={isCompact}
              isWatched={isWatched}
              onWatchlistToggle={handleWatchlistToggle}
              endTime={liveWindow.effectiveEndTime}
              isClosed={isClosed}
              startTime={liveWindow.effectiveStartTime}
              isNotStarted={isNotStarted}
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
                  aria-hidden="true"
                >
                  <Gavel className="h-3.5 w-3.5" />
                </div>
                <span className="sr-only">
                  {auction.status === "sold" ? "Sold auction" : "Closed auction"}
                </span>
              </div>
            )}
            {isNotStarted && isCompact && (
              <div className="absolute top-1.5 right-1.5 z-10">
                <div
                  className="rounded-full flex items-center justify-center shadow-lg bg-warning text-warning-foreground h-6 w-6"
                  aria-hidden="true"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                </div>
                <span className="sr-only">Scheduled auction, not yet started</span>
              </div>
            )}
          </div>

          {isClosed && !isCompact && (
            <div className="absolute top-3 right-3 z-10">
              <Badge
                variant={
                  auction.status === "sold" ? "secondary" : "destructive"
                }
                className="font-semibold shadow-lg"
              >
                {auction.status === "sold"
                  ? "Sold"
                  : auction.status === "unsold"
                    ? "Unsold"
                    : "Closed"}
              </Badge>
            </div>
          )}

          {isNotStarted && !isCompact && (
            <div className="absolute top-3 right-3 z-10">
              <Badge className="font-semibold shadow-lg bg-warning text-warning-foreground gap-1">
                <CalendarClock className="h-3 w-3" />
                Scheduled
              </Badge>
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <CardHeader
              className={cn(
                isCompact ? "p-3 pb-1" : "p-3 sm:p-4 md:p-5 pb-0 md:pb-0"
              )}
            >
              <div className="flex flex-wrap gap-1 mb-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 py-0 px-1 border-primary/20 text-primary bg-primary/5 font-medium",
                    isCompact ? "text-[10px]" : "text-xs"
                  )}
                >
                  {auction.categoryName}
                </Badge>
              </div>
              <div className="flex justify-between items-start gap-2">
                <CardTitle
                  className={cn(
                    "leading-tight font-semibold group-hover:text-primary transition-colors",
                    isCompact
                      ? "line-clamp-3 text-xs sm:text-sm md:text-base"
                      : "line-clamp-2 text-lg md:text-xl"
                  )}
                >
                  {auction.title}
                </CardTitle>
              </div>

              {isCompact ? (
                <p className="text-[10px] sm:text-xs leading-tight text-muted-foreground font-medium line-clamp-2 mt-1.5 italic">
                  {auction.description}
                </p>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-muted-foreground font-medium text-sm">
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
                "@container flex-1 flex flex-col justify-end pt-0 md:pt-0",
                isCompact ? "p-3" : "p-3 sm:p-4 md:p-5"
              )}
            >
              {/* Compact cards hide the full price block, so surface the current
                  bid on phones where the bid button truncates the figure. */}
              {isCompact && (
                <p className="text-[11px] font-medium text-muted-foreground whitespace-nowrap sm:hidden">
                  Current bid{" "}
                  <span className="font-bold tabular-nums text-primary">
                    {formatCurrency(auction.currentPrice)}
                  </span>
                </p>
              )}
              <AuctionCardPrice
                currentPrice={auction.currentPrice}
                endTime={liveWindow.effectiveEndTime}
                isCompact={isCompact}
                isClosed={isClosed}
                startTime={liveWindow.effectiveStartTime}
                isNotStarted={isNotStarted}
              />
            </CardContent>
          </div>
        </Link>

        <div
          className={cn(
            "bg-muted/20 border-t flex gap-2 items-center mt-auto shrink-0",
            isCompact ? "p-3 h-12" : "p-3 sm:p-4 md:p-5"
          )}
        >
          <Button
            size="sm"
            variant={isCompact ? "default" : "outline"}
            className={cn(
              "flex-1 font-semibold shadow-sm",
              isCompact
                ? "text-[10px] h-8 rounded-md"
                : "text-xs h-11 rounded-md"
            )}
            onClick={handleBidInitiate}
            disabled={isBidding || !liveWindow.isLive}
          >
            {isBidding
              ? "..."
              : isNotStarted
                ? "Not Started"
                : isUnavailable
                  ? "Unavailable"
                  : isClosed
                    ? "Closed"
                    : `Bid ${formatCurrency(auction.currentPrice + auction.minIncrement)}`}
          </Button>
        </div>
      </div>

      <BidConfirmation
        isOpen={isConfirmOpen}
        amount={pendingBid ?? 0}
        onConfirm={handleBidConfirm}
        onCancel={() => {
          setIsConfirmOpen(false);
          setPendingBid(null);
        }}
      />
    </Card>
  );
};
