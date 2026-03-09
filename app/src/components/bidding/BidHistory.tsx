// app/src/components/bidding/BidHistory.tsx
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { History, User, ChevronDown } from "lucide-react";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";

interface BidHistoryProps {
  auctionId: Id<"auctions">;
}

const PAGE_SIZE = 20;

/**
 * Renders a paginated history of bids for a specific auction within an accordion.
 *
 * This component fetches paginated bids using `usePaginatedQuery(api.auctions.getAuctionBids)`
 * and the total bid count via `useQuery(api.auctions.getAuctionBidCount)`. It initially
 * loads `initialNumItems` (PAGE_SIZE) bids and allows loading more via the `loadMore` function.
 *
 * @param props - The component props
 * @param props.auctionId - The unique identifier of the auction
 */
export const BidHistory = ({ auctionId }: BidHistoryProps) => {
  const auction = useQuery(api.auctions.getAuctionById, { auctionId });
  const highestBidAmount = auction?.currentPrice ?? -1;

  const {
    results: bids,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getAuctionBids,
    { auctionId },
    { initialNumItems: PAGE_SIZE }
  );

  const totalBids = useQuery(api.auctions.getAuctionBidCount, { auctionId });

  const anonymizeName = (name: string) => {
    if (!name) return "Anonymous";
    const parts = name.split(" ");
    return parts
      .map((part) => {
        if (part.length <= 1) return part;
        return part[0] + "*".repeat(Math.min(part.length - 1, 3));
      })
      .join(" ");
  };

  const formatTime = (timestamp: number) => {
    return new Intl.DateTimeFormat("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(new Date(timestamp));
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="bid-history" className="border-none">
        <AccordionTrigger className="hover:no-underline py-4 px-0">
          <div className="flex items-center gap-2 text-lg font-bold uppercase tracking-tight">
            <History className="h-5 w-5 text-primary" />
            Bid History
            {bids.length > 0 && (
              <span className="ml-2 bg-primary/10 text-primary text-xs py-0.5 px-2 rounded-full font-black">
                {bids.length}
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-6">
          {status === "LoadingFirstPage" ? (
            <div className="flex justify-center py-8">
              <LoadingIndicator size="sm" />
            </div>
          ) : bids.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed">
              <p className="text-muted-foreground text-sm font-medium">
                No bids have been placed yet.
              </p>
              <p className="text-[10px] text-muted-foreground uppercase mt-1">
                Be the first to bid on this item!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bids.map((bid) => {
                const isHighest = bid.amount === highestBidAmount;
                return (
                  <div
                    key={bid._id}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                      isHighest
                        ? "bg-primary/5 border-primary/20 shadow-sm"
                        : "bg-card border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          isHighest
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <User className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold tracking-tight">
                          {anonymizeName(bid.bidderName)}
                          {isHighest && (
                            <span className="ml-2 text-[9px] uppercase bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-black tracking-widest">
                              Highest
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase">
                          {formatTime(bid.timestamp)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-base font-black tracking-tight ${isHighest ? "text-primary" : "text-foreground"}`}
                      >
                        R {bid.amount.toLocaleString("en-ZA")}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="pt-2 flex flex-col items-center gap-2">
                {totalBids !== undefined && totalBids > 0 && (
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Showing {bids.length} of {totalBids} Bids
                  </p>
                )}

                {status === "CanLoadMore" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadMore(PAGE_SIZE)}
                    className="group border-2 font-bold uppercase tracking-tight text-[10px] h-8 px-4"
                  >
                    Load More Bids
                    <ChevronDown className="ml-1 h-3 w-3 group-hover:translate-y-0.5 transition-transform" />
                  </Button>
                )}
              </div>
              {status === "LoadingMore" && (
                <div className="flex justify-center py-2">
                  <LoadingIndicator size="sm" />
                </div>
              )}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
