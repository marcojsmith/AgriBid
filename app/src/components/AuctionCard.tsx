// app/src/components/AuctionCard.tsx
import React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "./CountdownTimer";
import type { Doc } from "../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

interface AuctionCardProps {
  auction: Doc<"auctions">;
}

export const AuctionCard = ({ auction }: AuctionCardProps) => {
  const placeBid = useMutation(api.auctions.placeBid);
  const [isBidding, setIsBidding] = useState(false);

  const handleBid = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBidding(true);
    try {
      const bidAmount = auction.currentPrice + auction.minIncrement;
      await placeBid({ auctionId: auction._id, amount: bidAmount });
      toast.success("Bid placed successfully!");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to place bid");
    } finally {
      setIsBidding(false);
    }
  };

  return (
    <Card className="overflow-hidden border-2 hover:border-primary transition-colors bg-card group">
      <Link to={`/auction/${auction._id}`}>
        <div className="aspect-video bg-muted flex items-center justify-center relative">
          {auction.images && auction.images.length > 0 ? (
            <img src={auction.images[0]} alt={auction.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="text-muted-foreground flex flex-col items-center">
              <span className="text-4xl">🚜</span>
              <span className="text-xs mt-2 italic text-center px-4">Image Pending (Seller Inspection in Progress)</span>
            </div>
          )}
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs font-semibold">
            {auction.year} {auction.make}
          </div>
        </div>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg leading-tight font-bold group-hover:text-primary transition-colors">{auction.title}</CardTitle>
          <div className="flex justify-between items-center mt-1 text-muted-foreground">
            <div className="flex items-center gap-1 text-sm">
              <MapPin className="h-3 w-3" />
              <span>{auction.location}</span>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-3 w-3" />
              <span>{auction.operatingHours.toLocaleString()} hrs</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex justify-between items-end mt-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Current Bid</p>
              <p className="text-2xl font-black text-primary tracking-tighter">R{auction.currentPrice.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Ends In</p>
              <CountdownTimer endTime={auction.endTime} />
            </div>
          </div>
        </CardContent>
      </Link>
      <CardFooter className="p-4 bg-muted/30 border-t flex gap-2">
        <Button className="flex-1 font-bold" onClick={handleBid} disabled={isBidding || auction.status !== 'active'}>
          {isBidding ? "Processing..." : `Bid R${(auction.currentPrice + auction.minIncrement).toLocaleString()}`}
        </Button>
        <Button variant="outline" size="icon" className="shrink-0" aria-label="View auction details" asChild>
          <Link to={`/auction/${auction._id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
