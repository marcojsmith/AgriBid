// app/src/components/bidding/BidForm.tsx
import { useState, useEffect, useRef } from "react";
import type { Doc } from "convex/_generated/dataModel";
import { TrendingUp, ArrowUpCircle, Clock, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
 * @param props.auction
 * @param props.onBid
 * @param props.isLoading
 * @param props.isBidFormEnabled
 * @param props.currentUserMaxBid
 * @param props.isProxyActive
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
  const [isProxyEnabled, setIsProxyEnabled] = useState(isProxyActive || false);
  const [maxBid, setMaxBid] = useState<string>(
    currentUserMaxBid != null ? String(currentUserMaxBid) : ""
  );

  // Keep track of the latest manualAmount without triggering effects
  const manualAmountRef = useRef(manualAmount);
  useEffect(() => {
    manualAmountRef.current = manualAmount;
  }, [manualAmount]);

  /**
   * Sync proxy states with server-backed props when they change.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsProxyEnabled(isProxyActive || false);
  }, [isProxyActive]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMaxBid(currentUserMaxBid != null ? String(currentUserMaxBid) : "");
  }, [currentUserMaxBid]);

  /**
   * Sync manualAmount with nextMinBid whenever the current price updates.
   * This ensures the user always starts with a valid minimum bid amount,
   * but doesn't clobber their input if they've already typed a higher value.
   */
  useEffect(() => {
    const currentManualNum = parseFloat(manualAmountRef.current) || 0;
    if (currentManualNum < nextMinBid) {
      const newAmount = nextMinBid.toString();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setManualAmount(newAmount);
      manualAmountRef.current = newAmount;
    }
  }, [nextMinBid]);

  const currentManualNum = parseFloat(manualAmount) || 0;
  const currentMaxBidNum = parseFloat(maxBid) || 0;
  const isManualValid = currentManualNum >= nextMinBid;
  const isMaxBidValid =
    currentMaxBidNum >= nextMinBid &&
    (!isProxyEnabled || currentMaxBidNum >= currentManualNum);

  const quickBids = [
    nextMinBid,
    nextMinBid + auction.minIncrement,
    nextMinBid + auction.minIncrement * 5,
  ];

  /**
   * Submits a manual bid using the current manualAmount state.
   * Handles both direct and proxy bids based on the isProxyEnabled toggle.
   * Short-circuits if the manual bid is invalid or the proxy max bid is insufficient.
   */
  const handleManualBid = () => {
    if (isProxyEnabled) {
      onBid(currentManualNum, currentMaxBidNum, true);
    } else {
      onBid(currentManualNum);
    }
  };

  /**
   * Submits a quick bid for a specific pre-calculated amount.
   * Handles both direct and proxy bids based on the isProxyEnabled toggle.
   *
   * @param amount - The quick bid amount to submit
   */
  const handleQuickBid = (amount: number) => {
    if (isProxyEnabled) {
      onBid(amount, currentMaxBidNum, true);
    } else {
      onBid(amount);
    }
  };

  /**
   * Calculates the available quick bid amounts based on the current auction state.
   * When proxy bidding is enabled, filters out amounts that exceed the current max bid limit.
   *
   * @returns An array of valid quick bid amounts
   */
  const getQuickBidAmounts = () => {
    if (isProxyEnabled) {
      // Show quick bids that are within the max bid range if max bid is valid for at least the minimum
      const maxBidAmount = currentMaxBidNum;
      if (maxBidAmount >= nextMinBid) {
        const validQuickBids = quickBids.filter(
          (bid) => bid >= nextMinBid && bid <= maxBidAmount
        );

        if (validQuickBids.length > 0) {
          return validQuickBids;
        }
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
                id="proxy-enabled"
                checked={isProxyEnabled}
                onChange={(e) => setIsProxyEnabled(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4 text-primary-foreground border-primary-foreground"
              />
              <label
                htmlFor="proxy-enabled"
                className="text-sm font-medium cursor-pointer"
              >
                Enable Auto-bid (Proxy Bidding)
              </label>
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
                <label
                  htmlFor="proxy-max-bid"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Max Bid:
                </label>
                <input
                  type="number"
                  id="proxy-max-bid"
                  value={maxBid}
                  onChange={(e) => setMaxBid(e.target.value)}
                  placeholder="Enter max amount"
                  className="w-32 h-8 px-2 py-1 text-sm rounded border border-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isLoading}
                />
                {currentUserMaxBid != null && (
                  <span className="text-xs text-muted-foreground">
                    Current: R{currentUserMaxBid.toLocaleString()}
                  </span>
                )}
              </div>
              {!isMaxBidValid && maxBid !== "" && (
                <p className="text-destructive text-xs font-bold mt-1">
                  {currentMaxBidNum < nextMinBid
                    ? `Max bid must be at least R${nextMinBid.toLocaleString()}`
                    : `Max bid must be at least the manual amount of R${currentManualNum.toLocaleString()}`}
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
              (isProxyEnabled && (!isMaxBidValid || currentMaxBidNum < amount))
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

      {isProxyEnabled &&
        currentMaxBidNum < currentManualNum &&
        maxBid !== "" && (
          <p className="text-destructive text-xs font-bold flex items-center gap-1.5 ml-1">
            <AlertTriangle className="h-3 w-3" />
            Max bid must be at least the manual amount of R{" "}
            {currentManualNum.toLocaleString()}
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
