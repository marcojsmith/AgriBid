// app/src/components/AuctionHeader.tsx
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, HardDrive, Heart } from "lucide-react";
import type { Doc } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useSession } from "../lib/auth-client";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { cn, isValidCallbackUrl } from "@/lib/utils";

interface AuctionHeaderProps {
  auction: Doc<"auctions">;
}

export const AuctionHeader = ({ auction }: AuctionHeaderProps) => {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isWatched = useQuery(api.watchlist.isWatched, { auctionId: auction._id });
  const toggleWatchlist = useMutation(api.watchlist.toggleWatchlist);

  const handleWatchlistToggle = async () => {
    if (!session) {
      toast.info("Please sign in to watch an auction");
      const rawUrl = location.pathname;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="secondary" className="font-bold">
          {auction.year} {auction.make}
        </Badge>
        <Badge variant="outline" className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
          ID: {auction._id.toString().slice(-8)}
        </Badge>
      </div>
      
      <div className="flex justify-between items-start gap-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-primary uppercase leading-tight flex-1">
          {auction.title}
        </h1>
        <Button
          variant="outline"
          size="lg"
          className={cn(
            "rounded-xl border-2 font-black uppercase text-xs tracking-widest gap-2 h-12 px-6 transition-all shrink-0",
            isWatched ? "border-red-500/50 text-red-500 hover:bg-red-50 hover:text-red-600" : "text-zinc-500 hover:border-primary hover:text-primary"
          )}
          onClick={handleWatchlistToggle}
        >
          <Heart className={cn("h-4 w-4", isWatched && "fill-current")} />
          {isWatched ? "Watching" : "Watch"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-6 text-muted-foreground pt-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary/60" />
          <span className="font-medium text-foreground">{auction.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-primary/60" />
          <span className="font-medium text-foreground">{auction.operatingHours.toLocaleString()} Operating Hours</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary/60" />
          <span className="font-medium text-foreground">Year {auction.year}</span>
        </div>
      </div>
    </div>
  );
};
