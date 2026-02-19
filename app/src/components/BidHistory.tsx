// app/src/components/BidHistory.tsx
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { History, User } from "lucide-react";

interface BidHistoryProps {
  auctionId: Id<"auctions">;
}

export const BidHistory = ({ auctionId }: BidHistoryProps) => {
  const bids = useQuery(api.auctions.getAuctionBids, { auctionId });

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
            {bids && bids.length > 0 && (
              <span className="ml-2 bg-primary/10 text-primary text-xs py-0.5 px-2 rounded-full font-black">
                {bids.length}
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-6">
          {!bids ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
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
              {[...bids]
                .sort((a, b) => b.amount - a.amount)
                .map((bid, index) => (
                  <div
                    key={bid._id}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                      index === 0
                        ? "bg-primary/5 border-primary/20 shadow-sm"
                        : "bg-card border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          index === 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <User className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold tracking-tight">
                          {anonymizeName(bid.bidderName)}
                          {index === 0 && (
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
                        className={`text-base font-black tracking-tight ${index === 0 ? "text-primary" : "text-foreground"}`}
                      >
                        R {bid.amount.toLocaleString("en-ZA")}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
