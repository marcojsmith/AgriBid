import { memo } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Gavel,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/CountdownTimer";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";

import type { MyBidAuction } from "./bidTypes";

interface StatusDisplay {
  /** Upper-case badge label shown on the card. */
  label: string;
  /** Icon rendered inside the badge. */
  icon: ReactNode;
  /** Tailwind classes for the badge background and text. */
  colorClass: string;
}

/**
 * Determine the user-facing badge label, icon and color for a bid's status.
 *
 * @param auction - The bid row to analyze
 * @returns A StatusDisplay object containing label, icon and colorClass
 */
function getStatusDisplay(auction: MyBidAuction): StatusDisplay {
  if (auction.isWon) {
    return {
      label: "WON",
      icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
      colorClass: "bg-success hover:bg-success/90 text-success-foreground",
    };
  }
  if (auction.status === "unsold") {
    return {
      label: "RESERVE NOT MET",
      icon: <XCircle className="h-3 w-3 mr-1" />,
      colorClass: "bg-muted text-muted-foreground",
    };
  }
  if (auction.isWinning) {
    return {
      label: "WINNING",
      icon: <TrendingUp className="h-3 w-3 mr-1" />,
      colorClass: "bg-success hover:bg-success/90 text-success-foreground",
    };
  }
  if (auction.isOutbid) {
    return {
      label: "OUTBID",
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
      colorClass:
        "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
    };
  }
  if (auction.isCancelled) {
    return {
      label: "CANCELLED",
      icon: <XCircle className="h-3 w-3 mr-1" />,
      colorClass: "border-warning text-warning",
    };
  }

  return {
    label: auction.status.toUpperCase(),
    icon: <Clock className="h-3 w-3 mr-1" />,
    colorClass: "border-muted-foreground text-muted-foreground",
  };
}

interface BidCardProps {
  /** The bid row to render. */
  auction: MyBidAuction;
}

/**
 * Card summarising one lot the user has bid on: image, status badge, the
 * countdown while the lot is live, the user's bid versus the next minimum and
 * a link through to the lot.
 *
 * Memoized so changing the list filter or sort order does not re-render every
 * card.
 *
 * @param props - Component props
 * @param props.auction - The bid row to render
 * @returns The rendered bid card
 */
export const BidCard = memo(function BidCard({ auction }: BidCardProps) {
  const { label, icon, colorClass } = getStatusDisplay(auction);
  const nextMinBid = auction.currentPrice + auction.minIncrement;
  const endTime = auction.extendedEndTime ?? auction.auctionEndTime;

  return (
    <div
      className={cn(
        "group relative bg-card border rounded-md overflow-hidden transition-[transform,shadow] duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col sm:flex-row sm:h-48 border-border/50"
      )}
    >
      {/* Status Strip Indicator */}
      {auction.isWinning && (
        <div className="absolute top-0 left-0 w-1 h-full bg-success z-20 hidden sm:block" />
      )}
      {auction.isOutbid && (
        <div className="absolute top-0 left-0 w-1 h-full bg-destructive z-20 hidden sm:block" />
      )}

      {/* Image Section */}
      <div className="w-full sm:w-48 md:w-56 shrink-0 bg-muted relative overflow-hidden border-b sm:border-b-0 sm:border-r border-border/10">
        {auction.images.front ? (
          <img
            src={auction.images.front}
            alt={auction.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Gavel className="h-10 w-10 text-muted-foreground/10" />
          </div>
        )}

        <div className="absolute top-2 left-2">
          <Badge
            className={cn(
              "px-2 py-0.5 font-semibold text-xs rounded-full shadow-lg",
              colorClass
            )}
          >
            <div className="flex items-center">
              {icon}
              {label}
            </div>
          </Badge>
        </div>

        {auction.status === "assigned" && endTime != null && (
          <div className="absolute bottom-2 right-2">
            <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-lg">
              <div className="flex items-center gap-1.5">
                <Clock className="h-2.5 w-2.5 text-white" />
                <CountdownTimer
                  endTime={endTime}
                  className="text-xs text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 p-5 flex flex-col min-w-0">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base leading-tight truncate group-hover:text-primary transition-colors">
              {auction.title}
            </h3>
          </div>
          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <span>{auction.make}</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <span>{auction.model}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 py-2 border-y border-border/5 my-auto">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground font-semibold">
              My Bid
            </p>
            <p className="font-bold text-sm tracking-tight tabular-nums">
              {formatCurrency(auction.myHighestBid)}
            </p>
            <p className="text-[10px] text-muted-foreground font-bold">
              {auction.bidCount} {auction.bidCount === 1 ? "bid" : "bids"}
            </p>
          </div>
          <div className="space-y-0.5 text-right border-l border-border/10 pl-3">
            <p className="text-xs text-muted-foreground font-semibold">
              {auction.status === "assigned" ? "Next Min" : "Final"}
            </p>
            <p
              className={cn(
                "font-bold text-sm tracking-tight tabular-nums",
                auction.status === "assigned"
                  ? "text-primary"
                  : auction.isWon
                    ? "text-success"
                    : "text-foreground"
              )}
            >
              {auction.status === "assigned"
                ? formatCurrency(nextMinBid)
                : formatCurrency(auction.currentPrice)}
            </p>
            {auction.isOutbid && (
              <p className="text-xs text-destructive font-semibold animate-pulse">
                Outbid!
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 font-semibold text-xs h-10 rounded-md transition-[background-color,transform,shadow]"
            variant={auction.isOutbid ? "default" : "outline"}
            asChild
          >
            <Link to={`/auction/${auction._id}`}>
              {auction.isOutbid ? (
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" />
                  Raise Bid
                </span>
              ) : auction.status === "assigned" ? (
                "View Details"
              ) : (
                "View Results"
              )}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
});
