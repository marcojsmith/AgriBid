// app/src/pages/dashboard/MyBids.tsx
import { useState, useMemo } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Gavel,
  Loader2,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { formatCurrency } from "@/lib/currency";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StatusDisplay {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
  colorClass: string;
}

type AuctionStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "sold"
  | "unsold"
  | "rejected";

interface Auction {
  _id: string;
  title: string;
  make: string;
  model: string;
  currentPrice: number;
  myHighestBid: number;
  bidCount: number;
  status: AuctionStatus;
  endTime?: number;
  isWinning: boolean;
  isWon: boolean;
  isOutbid: boolean;
  isCancelled: boolean;
  images: {
    front?: string;
  };
  lastBidTimestamp?: number;
}

/**
 * Determine the user-facing badge label, visual variant, icon, and color for an auction's bid status.
 */
function getStatusDisplay(auction: Auction): StatusDisplay {
  if (auction.isWon) {
    return {
      label: "WON",
      variant: "default",
      icon: <CheckCircle2 className="h-3 w-3 mr-1" />,
      colorClass: "bg-green-600 hover:bg-green-700 text-white",
    };
  }
  if (auction.status === "unsold") {
    return {
      label: "RESERVE NOT MET",
      variant: "destructive",
      icon: <XCircle className="h-3 w-3 mr-1" />,
      colorClass: "bg-gray-600 text-white",
    };
  }
  if (auction.isWinning) {
    return {
      label: "WINNING",
      variant: "secondary",
      icon: <TrendingUp className="h-3 w-3 mr-1" />,
      colorClass: "bg-green-600 hover:bg-green-700 text-white",
    };
  }
  if (auction.isOutbid) {
    return {
      label: "OUTBID",
      variant: "destructive",
      icon: <AlertCircle className="h-3 w-3 mr-1" />,
      colorClass: "bg-red-600 hover:bg-red-700 text-white",
    };
  }
  if (auction.isCancelled) {
    return {
      label: "CANCELLED",
      variant: "outline",
      icon: <XCircle className="h-3 w-3 mr-1" />,
      colorClass: "border-yellow-600 text-yellow-600",
    };
  }

  return {
    label: auction.status.toUpperCase(),
    variant: "outline",
    icon: <Clock className="h-3 w-3 mr-1" />,
    colorClass: "border-muted-foreground text-muted-foreground",
  };
}

export default function MyBids() {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("ending");

  const serverStats = useQuery(api.auctions.queries.getMyBidsStats);

  const {
    results: rawAuctions,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.queries.getMyBids,
    {},
    { initialNumItems: 50 }
  ); // Higher limit for client filtering

  const stats = serverStats || {
    totalActive: 0,
    winningCount: 0,
    outbidCount: 0,
    totalExposure: 0,
  };

  // Apply filtering and sorting
  const filteredAndSortedAuctions = useMemo(() => {
    let result = [...rawAuctions];

    // Filter
    if (filter === "winning") {
      result = result.filter((a) => a.isWinning && a.status === "active");
    } else if (filter === "outbid") {
      result = result.filter((a) => a.isOutbid && a.status === "active");
    } else if (filter === "ended") {
      result = result.filter(
        (a) => a.status === "sold" || a.status === "unsold"
      );
    }

    // Sort
    if (sortBy === "recent") {
      result.sort(
        (a, b) => (b.lastBidTimestamp || 0) - (a.lastBidTimestamp || 0)
      );
    } else if (sortBy === "ending") {
      // Active auctions first, then by end time
      result.sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return (a.endTime || 0) - (b.endTime || 0);
      });
    } else if (sortBy === "bid") {
      result.sort((a, b) => b.myHighestBid - a.myHighestBid);
    }

    return result;
  }, [rawAuctions, filter, sortBy]);

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Gavel className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-primary uppercase">
            My Bids
          </h1>
        </div>
      </div>

      {rawAuctions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-2">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">
                Active Bids
              </p>
              <p className="text-3xl font-black text-primary">
                {stats.totalActive}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-2">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">
                Winning
              </p>
              <p className="text-3xl font-black text-green-600">
                {stats.winningCount}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-2">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">
                Outbid
              </p>
              <p className="text-3xl font-black text-red-600">
                {stats.outbidCount}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-2">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">
                Total Exposure
              </p>
              <p className="text-xl font-black text-primary">
                {formatCurrency(stats.totalExposure)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {rawAuctions.length === 0 ? (
        <div className="max-w-4xl mx-auto space-y-8 py-24 text-center bg-card border-2 border-dashed rounded-3xl border-primary/10">
          <p className="text-muted-foreground text-lg max-w-md mx-auto font-bold uppercase tracking-widest">
            You haven’t placed any bids yet.
          </p>
          <Button
            size="lg"
            className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 transition-[transform,shadow,background-color] hover:scale-105 active:scale-95"
            asChild
          >
            <Link to="/">Browse Auctions</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
            <Tabs
              value={filter}
              onValueChange={setFilter}
              className="w-full sm:w-auto"
            >
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger
                  value="all"
                  className="font-bold text-xs uppercase tracking-widest px-4 transition-[background-color,color]"
                >
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="winning"
                  className="font-bold text-xs uppercase tracking-widest px-4 transition-[background-color,color]"
                >
                  Winning
                </TabsTrigger>
                <TabsTrigger
                  value="outbid"
                  className="font-bold text-xs uppercase tracking-widest px-4 transition-[background-color,color]"
                >
                  Outbid
                </TabsTrigger>
                <TabsTrigger
                  value="ended"
                  className="font-bold text-xs uppercase tracking-widest px-4 transition-[background-color,color]"
                >
                  Ended
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger
                  aria-label="Sort bids"
                  className="w-[180px] font-bold text-xs uppercase tracking-widest bg-muted/30 border-2 transition-[border-color,background-color]"
                >
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="ending"
                    className="font-bold text-xs uppercase tracking-widest"
                  >
                    Ending Soon
                  </SelectItem>
                  <SelectItem
                    value="recent"
                    className="font-bold text-xs uppercase tracking-widest"
                  >
                    Recent Activity
                  </SelectItem>
                  <SelectItem
                    value="bid"
                    className="font-bold text-xs uppercase tracking-widest"
                  >
                    Highest Bid
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredAndSortedAuctions.map((auction) => {
              const { label, icon, colorClass } = getStatusDisplay(auction);

              return (
                <div
                  key={auction._id}
                  className={cn(
                    "group relative bg-card border rounded-xl overflow-hidden transition-[transform,shadow] duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col sm:flex-row sm:h-48 border-border/50"
                  )}
                >
                  {/* Status Strip Indicator */}
                  {auction.isWinning && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-500 z-20 hidden sm:block" />
                  )}
                  {auction.isOutbid && (
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500 z-20 hidden sm:block" />
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
                          "px-2 py-0.5 font-black text-xs tracking-tighter uppercase rounded-full shadow-lg",
                          colorClass
                        )}
                      >
                        <div className="flex items-center">
                          {icon}
                          {label}
                        </div>
                      </Badge>
                    </div>

                    {auction.status === "active" && auction.endTime != null && (
                      <div className="absolute bottom-2 right-2">
                        <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 shadow-lg">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-2.5 w-2.5 text-white" />
                            <CountdownTimer
                              endTime={auction.endTime}
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
                        <h3 className="font-black text-base leading-tight truncate group-hover:text-primary transition-colors uppercase tracking-tight">
                          {auction.title}
                        </h3>
                      </div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                        <span>{auction.make}</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                        <span>{auction.model}</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-2 border-y border-border/5 my-auto">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground uppercase font-black tracking-tighter">
                          My Bid
                        </p>
                        <p className="font-black text-sm tracking-tight tabular-nums">
                          {formatCurrency(auction.myHighestBid)}
                        </p>
                        <p className="text-xs text-muted-foreground font-bold">
                          {auction.bidCount}{" "}
                          {auction.bidCount === 1 ? "bid" : "bids"}
                        </p>
                      </div>
                      <div className="space-y-0.5 text-right border-l border-border/10 pl-3">
                        <p className="text-xs text-muted-foreground uppercase font-black tracking-tighter">
                          Current
                        </p>
                        <p
                          className={cn(
                            "font-black text-sm tracking-tight tabular-nums",
                            auction.isWinning
                              ? "text-green-600"
                              : "text-primary"
                          )}
                        >
                          {formatCurrency(auction.currentPrice)}
                        </p>
                        {auction.isOutbid && (
                          <p className="text-xs text-red-600 font-black animate-pulse uppercase">
                            Outbid!
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 font-black uppercase text-xs tracking-wider h-10 rounded-xl transition-[background-color,transform,shadow]"
                        variant={auction.isOutbid ? "default" : "outline"}
                        asChild
                      >
                        <Link to={`/auction/${auction._id}`}>
                          {auction.isOutbid ? (
                            <span className="flex items-center gap-1.5">
                              <TrendingUp className="h-3 w-3" />
                              Raise Bid
                            </span>
                          ) : auction.status === "active" ? (
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
            })}
          </div>

          {filteredAndSortedAuctions.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-muted-foreground font-bold uppercase tracking-widest">
                No auctions found matching this filter.
              </p>
            </div>
          )}

          <div className="flex justify-center pt-8">
            {status === "CanLoadMore" ? (
              <Button
                variant="outline"
                onClick={() => loadMore(10)}
                className="h-12 px-10 rounded-xl font-black uppercase tracking-widest border-2 hover:bg-primary hover:text-white transition-[background-color,color,border-color]"
              >
                Load More
              </Button>
            ) : status === "LoadingMore" ? (
              <Button
                disabled
                variant="outline"
                className="h-12 px-10 rounded-xl border-2"
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
