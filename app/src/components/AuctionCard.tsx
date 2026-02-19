// app/src/components/AuctionCard.tsx
import React, { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "./CountdownTimer";
import type { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useSession } from "../lib/auth-client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Clock, MapPin, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { BidConfirmation } from "./BidConfirmation";
import { isValidCallbackUrl, cn } from "@/lib/utils";

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
        {/* Left Side (Compact) / Top Side (Detailed) */}
        <div
          className={cn(
            "shrink-0 flex flex-col",
            isCompact ? "w-[120px] sm:w-[160px] md:w-[180px]" : "w-full",
          )}
        >
          <div
            className={cn(
              "bg-muted flex items-center justify-center relative overflow-hidden",
              isCompact ? "flex-1 border-r" : "aspect-video",
            )}
          >
            {primaryImage ? (
              <img
                src={primaryImage}
                alt={auction.title}
                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="text-muted-foreground flex flex-col items-center">
                <span className={isCompact ? "text-2xl" : "text-4xl"}>🚜</span>
                <span
                  className={cn(
                    "italic text-center px-2",
                    isCompact ? "text-[8px]" : "text-xs mt-2",
                  )}
                >
                  Image Pending
                </span>
              </div>
            )}

            {/* Watchlist Heart Button (Top Left) */}
            <div
              className={cn(
                "absolute top-1.5 left-1.5",
                !isCompact && "top-3 left-3",
              )}
            >
              <Button
                variant="secondary"
                size="icon"
                aria-label={
                  isWatched ? "Remove from watchlist" : "Add to watchlist"
                }
                aria-pressed={!!isWatched}
                className={cn(
                  "rounded-full shadow-md bg-background/80 backdrop-blur hover:bg-background transition-all",
                  isCompact ? "h-7 w-7" : "h-9 w-9",
                  isWatched ? "text-red-500" : "text-zinc-500",
                )}
                onClick={handleWatchlistToggle}
              >
                <Heart
                  className={cn(
                    isCompact ? "h-3.5 w-3.5" : "h-5 w-5",
                    isWatched && "fill-current",
                  )}
                />
              </Button>
            </div>

            {/* Badges - Detailed Overlay (Top Right) */}
            {!isCompact && (
              <div className="absolute top-3 right-3">
                <div className="bg-background/80 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm">
                  {auction.year} {auction.make}
                </div>
              </div>
            )}
          </div>

          {/* Timer - Under Image */}
          <div
            className={cn(
              "bg-muted/30 flex items-center justify-center px-2 border-r",
              isCompact ? "h-12 border-t" : "hidden",
            )}
          >
            <div
              className={cn(
                "font-black whitespace-nowrap leading-none",
                isCompact ? "text-sm sm:text-base" : "text-[10px]",
              )}
            >
              <CountdownTimer endTime={auction.endTime} />
            </div>
          </div>
        </div>

        {/* Right Side (Compact) / Bottom Side (Detailed) */}
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
            {!isCompact && (
              <div className="flex justify-between items-end mt-2 md:mt-4">
                <div>
                  <p className="text-muted-foreground uppercase font-black tracking-widest text-[10px] md:text-xs">
                    Current Bid
                  </p>
                  <p className="font-black text-primary tracking-tighter leading-none text-2xl md:text-3xl">
                    R {auction.currentPrice.toLocaleString("en-ZA")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                    Ends In
                  </p>
                  <div className="text-sm font-bold">
                    <CountdownTimer endTime={auction.endTime} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {/* Action Footer */}
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
