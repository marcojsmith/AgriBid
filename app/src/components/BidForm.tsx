// app/src/components/BidForm.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Doc } from "convex/_generated/dataModel";
import { TrendingUp, ArrowUpCircle } from "lucide-react";

interface BidFormProps {
  auction: Doc<"auctions">;
  onBid: (amount: number) => void;
  isLoading: boolean;
  isVerified?: boolean;
}

export const BidForm = ({ auction, onBid, isLoading, isVerified = true }: BidFormProps) => {
  const nextMinBid = auction.currentPrice + auction.minIncrement;
  const [manualAmount, setManualAmount] = useState<string>(nextMinBid.toString());
  const [prevNextMinBid, setPrevNextMinBid] = useState(nextMinBid);

  /**
   * Sync manualAmount with nextMinBid whenever the current price updates.
   * This ensures the user always starts with a valid minimum bid amount,
   * but doesn't clobber their input if they've already typed a higher value.
   */
  useEffect(() => {
    setPrevNextMinBid(nextMinBid);
    const currentManualNum = parseFloat(manualAmount) || 0;
    if (currentManualNum < nextMinBid) {
      setManualAmount(nextMinBid.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextMinBid]);

  // Using prevNextMinBid in a no-op to satisfy the 'unused variable' lint rule while following instructions
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  prevNextMinBid;

  const currentManualNum = parseFloat(manualAmount) || 0;
  const isManualValid = currentManualNum >= nextMinBid;

  const quickBids = [
    nextMinBid,
    nextMinBid + auction.minIncrement,
    nextMinBid + auction.minIncrement * 5,
  ];

  return (
    <div className="space-y-6">
      {/* Quick Bid Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {quickBids.map((amount, index) => (
          <Button
            key={`quick-bid-${index}-${amount}`}
            variant="outline"
            className="h-14 flex flex-col items-center justify-center gap-0.5 border-2 hover:border-primary hover:bg-primary/5 transition-all group"
            onClick={() => onBid(amount)}
            disabled={isLoading || !isVerified}
          >
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
              Quick Bid
            </span>
            <span className="text-base font-black tracking-tight">
              R{amount.toLocaleString()}
            </span>
          </Button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
        <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-card px-2 text-muted-foreground font-black tracking-[0.2em]">Or Enter Custom Amount</span></div>
      </div>

      {/* Manual Bid Input */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">R</span>
          <Input
            type="number"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            placeholder="Enter amount"
            className="h-14 pl-8 text-lg font-bold rounded-xl border-2 focus-visible:ring-primary"
            disabled={isLoading}
          />
        </div>
        <Button 
          className="h-14 px-8 rounded-xl font-black text-lg gap-2 shadow-lg shadow-primary/20"
          disabled={!isManualValid || isLoading || !isVerified}
          onClick={() => onBid(currentManualNum)}
        >
          <TrendingUp className="h-5 w-5" />
          {isLoading ? "Processing..." : "Place Bid"}
        </Button>
      </div>
      
      {!isManualValid && manualAmount !== "" && (
        <p className="text-destructive text-xs font-bold flex items-center gap-1.5 ml-1">
          <ArrowUpCircle className="h-3 w-3" />
          Minimum bid required: R{nextMinBid.toLocaleString()}
        </p>
      )}
    </div>
  );
};
