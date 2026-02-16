// app/src/components/BiddingPanel.tsx
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useSession } from "../lib/auth-client";
import { useLocation, useNavigate } from "react-router-dom";
import { CountdownTimer } from "./CountdownTimer";
import type { Doc } from "convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Gavel, Info } from "lucide-react";
import { BidForm } from "./BidForm";
import { BidConfirmation } from "./BidConfirmation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isValidCallbackUrl } from "@/lib/utils";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";

interface BiddingPanelProps {
  auction: Doc<"auctions">;
}

export const BiddingPanel = ({ auction }: BiddingPanelProps) => {
  const { data: session, isPending } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  const [isBidding, setIsBidding] = useState(false);
  
  const placeBid = useMutation(api.auctions.placeBid);

  const isEnded = auction.status !== "active" || auction.endTime <= Date.now();
  const nextMinBid = auction.currentPrice + auction.minIncrement;

  if (auction.status !== 'active') {
    const isWon = session?.user?.id === auction.winnerId;
    
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="text-center space-y-2">
          <Badge variant={auction.status === 'sold' ? "default" : "destructive"} className="font-black uppercase tracking-widest px-4 py-1.5 text-xs mb-2">
            Auction {auction.status.toUpperCase()}
          </Badge>
          <h3 className="text-3xl font-black text-primary tracking-tighter">
            R {auction.currentPrice.toLocaleString('en-ZA')}
          </h3>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Final Price</p>
        </div>

        <div className="bg-muted/30 border-2 rounded-2xl p-6 text-center space-y-4">
          {auction.status === 'sold' ? (
            <>
              <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <Gavel className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-1">
                <p className="font-black uppercase text-sm">Winning Bid Confirmed</p>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                  {isWon ? "Congratulations, you are the buyer!" : "This item has found a new owner."}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <Info className="h-8 w-8 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="font-black uppercase text-sm">Auction Closed</p>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                  {auction.currentPrice === auction.startingPrice ? "No bids received." : "Reserve price was not met."}
                </p>
              </div>
            </>
          )}
        </div>

        <Button variant="outline" className="w-full h-14 rounded-xl font-black uppercase tracking-tight border-2" asChild>
          <Link to="/">Explore Other Auctions</Link>
        </Button>
      </div>
    );
  }

  const handleBidInitiate = (amount: number) => {
    if (isPending) {
      toast.info("Checking sign-in status...");
      return;
    }

    if (!session) {
      toast.info("Please sign in to place a bid");
      // Redirect to login page and provide a callback URL
      const rawUrl = `${location.pathname}${location.search}${location.hash}`;
      const callbackUrl = isValidCallbackUrl(rawUrl) ? encodeURIComponent(rawUrl) : "/";
      navigate(`/login?callbackUrl=${callbackUrl}`);
      return;
    }
    setPendingBid(amount);
    setIsConfirmOpen(true);
  };

  const handleBidConfirm = async () => {
    if (!pendingBid) return;

    // Guard against submitting after auction ends
    if (auction.status !== "active" || auction.endTime <= Date.now()) {
      toast.error("This auction has ended");
      setIsConfirmOpen(false);
      setPendingBid(null);
      return;
    }
    
    setIsConfirmOpen(false);
    setIsBidding(true);
    
    try {
      await placeBid({ auctionId: auction._id, amount: pendingBid });
      toast.success(`Bid of R${pendingBid.toLocaleString('en-ZA')} placed successfully!`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to place bid");
    } finally {
      setIsBidding(false);
      setPendingBid(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Current Bid</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-primary tracking-tighter">
              R{auction.currentPrice.toLocaleString('en-ZA')}
            </span>
            {!isEnded && (
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 animate-pulse">
                Live
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">Time Remaining</p>
          <div className="text-xl font-bold">
            <CountdownTimer endTime={auction.endTime} />
          </div>
        </div>
      </div>

      {isEnded ? (
        <div className="bg-muted/50 border-2 border-dashed rounded-xl p-6 text-center">
          <p className="font-bold text-muted-foreground uppercase tracking-widest text-sm">Auction Ended</p>
          <p className="text-xs text-muted-foreground mt-1">Final Price: R{auction.currentPrice.toLocaleString('en-ZA')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {auction.isExtended && (
            <Alert className="bg-amber-50 border-amber-200 text-amber-900 rounded-xl py-3 border-2">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-xs font-black uppercase tracking-widest mb-0.5">Soft Close Extended</AlertTitle>
              <AlertDescription className="text-[10px] font-bold leading-tight opacity-80 uppercase">
                Bidding activity has extended the auction to ensure a fair finish.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground bg-muted/30 p-3 rounded-lg border">
            <Gavel className="h-4 w-4 text-primary" />
            <span>Next minimum bid: <span className="text-foreground">R{nextMinBid.toLocaleString('en-ZA')}</span></span>
          </div>
          
          <BidForm 
            auction={auction} 
            onBid={handleBidInitiate} 
            isLoading={isBidding} 
          />
        </div>
      )}

      <BidConfirmation
        isOpen={isConfirmOpen}
        amount={pendingBid || 0}
        onConfirm={handleBidConfirm}
        onCancel={() => {
          setIsConfirmOpen(false);
          setPendingBid(null);
        }}
      />
    </div>
  );
};
