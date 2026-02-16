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
import { Eye, Clock, MapPin, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { BidConfirmation } from "./BidConfirmation";
import { isValidCallbackUrl, cn } from "@/lib/utils";

interface AuctionCardProps {
  auction: Doc<"auctions">;
}

export const AuctionCard = ({ auction }: AuctionCardProps) => {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const placeBid = useMutation(api.auctions.placeBid);
  const isWatched = useQuery(api.watchlist.isWatched, { auctionId: auction._id });
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
      const callbackUrl = isValidCallbackUrl(rawUrl) ? encodeURIComponent(rawUrl) : "/";
      navigate(`/login?callbackUrl=${callbackUrl}`);
      return;
    }

    try {
      const nowWatched = await toggleWatchlist({ auctionId: auction._id });
      toast.success(nowWatched ? "Added to watchlist" : "Removed from watchlist");
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
      const callbackUrl = isValidCallbackUrl(rawUrl) ? encodeURIComponent(rawUrl) : "/";
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
      toast.error(`Price updated to R${minimum.toLocaleString()} due to a newer bid.`);
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
      toast.error(error instanceof Error ? error.message : "Failed to place bid");
    } finally {
      setIsBidding(false);
      isBiddingRef.current = false;
      setPendingBid(null);
    }
  };

  const images = auction.images;
  const primaryImage = Array.isArray(images) 
    ? images[0] 
    : (images.front || images.engine || images.cabin || images.rear || images.additional?.[0]);

  return (
    <Card className="overflow-hidden border-2 hover:border-primary transition-colors bg-card group">
      <Link to={`/auction/${auction._id}`} className="flex flex-row md:flex-col h-full">
        {/* Left Side (Mobile) / Top Side (Desktop) */}
        <div className="w-1/3 md:w-full flex flex-col shrink-0">
          <div className="aspect-square md:aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
            {primaryImage ? (
              <img src={primaryImage} alt={auction.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
            ) : (
              <div className="text-muted-foreground flex flex-col items-center">
                <span className="text-2xl md:text-4xl">🚜</span>
                <span className="text-[8px] md:text-xs mt-1 md:mt-2 italic text-center px-2">Image Pending</span>
              </div>
            )}
            
            {/* Badges - Desktop Only Overlay */}
            <div className="hidden md:flex absolute top-2 right-2 flex-col items-end gap-2">
              <div className="bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-semibold">
                {auction.year} {auction.make}
              </div>
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full shadow-md bg-background/80 backdrop-blur hover:bg-background transition-all",
                  isWatched ? "text-red-500" : "text-zinc-500"
                )}
                onClick={handleWatchlistToggle}
              >
                <Heart className={cn("h-4 w-4", isWatched && "fill-current")} />
              </Button>
            </div>
          </div>
          
          {/* Mobile Timer - Under Image */}
          <div className="md:hidden flex-1 bg-muted/30 flex items-center justify-center py-2 px-1 border-r border-b">
            <div className="text-center">
              <p className="text-[8px] font-black text-muted-foreground uppercase tracking-tighter">Ends In</p>
              <div className="text-[10px] font-bold">
                <CountdownTimer endTime={auction.endTime} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side (Mobile) / Bottom Side (Desktop) */}
        <div className="flex-1 flex flex-col min-w-0">
          <CardHeader className="p-3 md:p-4 pb-1 md:pb-2">
            <div className="flex justify-between items-start gap-2">
              <CardTitle className="text-sm md:text-lg leading-tight font-black group-hover:text-primary transition-colors line-clamp-2 uppercase tracking-tight">
                {auction.title}
              </CardTitle>
              <div className="md:hidden shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 rounded-full",
                    isWatched ? "text-red-500" : "text-zinc-500"
                  )}
                  onClick={handleWatchlistToggle}
                >
                  <Heart className={cn("h-3.5 w-3.5", isWatched && "fill-current")} />
                </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-muted-foreground">
              <div className="flex items-center gap-1 text-[10px] md:text-sm font-bold">
                <MapPin className="h-3 w-3 text-primary/60" />
                <span className="truncate">{auction.location}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] md:text-sm font-bold">
                <Clock className="h-3 w-3 text-primary/60" />
                <span>{auction.operatingHours.toLocaleString()} hrs</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-3 md:p-4 pt-0 md:pt-0 flex-1 flex flex-col justify-end">
            <div className="flex justify-between items-end mt-2 md:mt-4">
              <div>
                <p className="text-[8px] md:text-[10px] text-muted-foreground uppercase font-black tracking-widest">Current Bid</p>
                <p className="text-base md:text-2xl font-black text-primary tracking-tighter leading-none">
                  R{auction.currentPrice.toLocaleString('en-ZA')}
                </p>
              </div>
              <div className="hidden md:block text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Ends In</p>
                <CountdownTimer endTime={auction.endTime} />
              </div>
            </div>
          </CardContent>

          {/* Desktop Footer (Integrated into Mobile Flow) */}
          <div className="p-3 md:p-4 bg-muted/20 border-t flex gap-2">
            <Button 
              size="sm"
              className="flex-1 font-black uppercase text-[10px] md:text-xs h-8 md:h-10 rounded-lg shadow-sm" 
              onClick={handleBidInitiate} 
              disabled={isBidding || auction.status !== 'active'}
            >
              {isBidding ? "..." : `Bid R${(auction.currentPrice + auction.minIncrement).toLocaleString('en-ZA')}`}
            </Button>
            <Button variant="outline" size="icon" className="shrink-0 h-8 w-8 md:h-10 md:w-10 rounded-lg border-2" aria-label="View auction details" asChild>
              <div className="flex items-center justify-center">
                <Eye className="h-3.5 w-3.5 md:h-4 w-4" />
              </div>
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
