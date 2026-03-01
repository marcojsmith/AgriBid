// app/src/components/bidding/BidForm.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Doc } from "convex/_generated/dataModel";
import { TrendingUp, ArrowUpCircle, Clock, AlertTriangle } from "lucide-react";

interface BidFormProps {
  /** The auction document containing current pricing and status */
  auction: Doc<"auctions">;
  /** Callback triggered when a bid amount is submitted */
  onBid: (amount: number, maxBid?: number, autoBidEnabled?: boolean) => void;
  /** Loading state during bid submission */
  isLoading: boolean;
  /** Whether the bid form is active; defaults to true */
  isBidFormEnabled?: boolean;
  /** Current user's highest proxy bid for this auction, if any */
  currentUserMaxBid?: number;
  /** Whether proxy bidding is currently active for this user */
  isProxyActive?: boolean;
}

/**
 * Interactive bid form for custom and quick bid submissions with proxy bidding support.
 *
 * @param props - Component props including auction data and handlers
 * @returns A React element for placing bids
 */
export const BidForm = ({
  auction,
  onBid,
  isLoading,
  isBidFormEnabled = true,
  currentUserMaxBid,
  isProxyActive,
}: BidFormProps) => {
  const nextMinBid = auction.currentPrice + auction.minIncrement;
  const [manualAmount, setManualAmount] = useState<string>(
    nextMinBid.toString()
  );
  const [isProxyEnabled, setIsProxyEnabled] = useState(false);
  const [maxBid, setMaxBid] = useState<string>("");

  /**
   * Sync manualAmount with nextMinBid whenever the current price updates.
   * This ensures the user always starts with a valid minimum bid amount,
   * but doesn't clobber their input if they've already typed a higher value.
   */
  useEffect(() => {
    const currentManualNum = parseFloat(manualAmount) || 0;
    if (currentManualNum < nextMinBid) {
      setManualAmount(nextMinBid.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextMinBid]);

  const currentManualNum = parseFloat(manualAmount) || 0;
  const currentMaxBidNum = parseFloat(maxBid) || 0;
  const isManualValid = currentManualNum >= nextMinBid;
  const isMaxBidValid = currentMaxBidNum >= nextMinBid;

  const quickBids = [
    nextMinBid,
    nextMinBid + auction.minIncrement,
    nextMinBid + auction.minIncrement * 5,
  ];

  const handleManualBid = () => {
    if (!isManualValid) return;

    if (isProxyEnabled && isMaxBidValid) {
      onBid(currentManualNum, currentMaxBidNum, true);
    } else {
      onBid(currentManualNum);
    }
  };

  const handleQuickBid = (amount: number) => {
    if (isProxyEnabled && isMaxBidValid) {
      onBid(amount, currentMaxBidNum, true);
    } else {
      onBid(amount);
    }
  };

  const getQuickBidAmounts = () => {
    if (isProxyEnabled && isMaxBidValid) {
      // Show quick bids that are within the max bid range
      const maxBidAmount = currentMaxBidNum;
      const validQuickBids = quickBids.filter(
        (bid) => bid >= nextMinBid && bid <= maxBidAmount
      );

      if (validQuickBids.length > 0) {
        return validQuickBids;
      }
    }
    return quickBids;
  };

  return (
    <div className="space-y-6">
      {/* Proxy Bidding Section - Show if the form is enabled (logged in) */}
      {isBidFormEnabled && (
        <div
          className={`border-2 ${isProxyActive ? "border-primary" : "border-muted-foreground"} border-opacity-20 rounded-xl p-4 mb-4`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isProxyEnabled}
                onChange={(e) => setIsProxyEnabled(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 text-primary-foreground border-primary-foreground"
              />
              <span className="text-sm font-medium">
                Enable Auto-bid (Proxy Bidding)
              </span>
            </div>
            {isProxyActive && (
              <span className="text-xs font-medium bg-primary/10 text-primary rounded-full px-2 py-1">
                Active
              </span>
            )}
          </div>

          {isProxyEnabled && (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Max Bid:
                </span>
                <input
                  type="number"
                  value={maxBid}
                  onChange={(e) => setMaxBid(e.target.value)}
                  placeholder="Enter max amount"
                  className="w-32 h-8 px-2 py-1 text-sm rounded border border-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isLoading}
                />
                {currentUserMaxBid !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    Current: R{currentUserMaxBid.toLocaleString()}
                  </span>
                )}
              </div>
              {!isMaxBidValid && maxBid !== "" && (
                <p className="text-destructive text-xs font-bold mt-1">
                  Max bid must be at least R{nextMinBid.toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Bid Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {getQuickBidAmounts().map((amount, index) => (
          <Button
            key={`quick-bid-${index}-${amount}`}
            variant="outline"
            className="h-14 flex flex-col items-center justify-center gap-0.5 border-2 hover:border-primary hover:bg-primary/5 transition-all group"
            onClick={() => handleQuickBid(amount)}
            disabled={
              isLoading ||
              !isBidFormEnabled ||
              (isProxyEnabled && !isMaxBidValid)
            }
          >
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
              Quick Bid
            </span>
            <span className="text-base font-black tracking-tight">
              R {amount.toLocaleString()}
            </span>
          </Button>
        ))}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t"></span>
        </div>
        <div className="relative flex justify-center text-[10px] uppercase">
          <span className="bg-card px-2 text-muted-foreground font-black tracking-[0.2em]">
            Or Enter Custom Amount
          </span>
        </div>
      </div>

      {/* Manual Bid Input */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
              R
            </span>
            <Input
              type="number"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              placeholder="Enter amount"
              className="h-14 pl-8 text-lg font-bold rounded-xl border-2 focus-visible:ring-primary"
              disabled={isLoading || !isBidFormEnabled}
            />
          </div>
          <Button
            className="h-14 px-8 rounded-xl font-black text-lg gap-2 shadow-lg shadow-primary/20"
            disabled={
              !isManualValid ||
              isLoading ||
              !isBidFormEnabled ||
              (isProxyEnabled && !isMaxBidValid)
            }
            onClick={handleManualBid}
          >
            <TrendingUp className="h-5 w-5" />
            {isLoading ? "Processing..." : "Place Bid"}
          </Button>
        </div>
      </div>

      {!isManualValid && manualAmount !== "" && (
        <p className="text-destructive text-xs font-bold flex items-center gap-1.5 ml-1">
          <ArrowUpCircle className="h-3 w-3" />
          Minimum bid required: R {nextMinBid.toLocaleString()}
        </p>
      )}

      {!isMaxBidValid && maxBid !== "" && (
        <p className="text-destructive text-xs font-bold flex items-center gap-1.5 ml-1">
          <AlertTriangle className="h-3 w-3" />
          Max bid must be at least R {nextMinBid.toLocaleString()}
        </p>
      )}

      {isProxyEnabled && isMaxBidValid && (
        <p className="text-muted-foreground text-xs mt-2">
          <Clock className="h-3 w-3 inline" /> Proxy bid will automatically
          increment bids up to R{currentMaxBidNum.toLocaleString()}
        </p>
      )}
    </div>
  );
};
