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

  const isWinner = session?.user?.id === auction.winnerId;
  const isSeller = session?.user?.id === auction.sellerId;

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
        {auction.status === 'sold' && (
          <Badge className="bg-green-600 hover:bg-green-700 font-black uppercase tracking-widest px-3 py-1">
            {isWinner ? "YOU WON" : "SOLD"}
          </Badge>
        )}
        {auction.status === 'unsold' && (
          <Badge variant="destructive" className="font-black uppercase tracking-widest px-3 py-1">
            UNSOLD
          </Badge>
        )}
      </div>
      
      <div className="flex justify-between items-start gap-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-primary uppercase leading-tight flex-1">
          {auction.title}
        </h1>
        {auction.status === 'active' && (
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
        )}
      </div>

      {isWinner && (
        <div className="bg-green-500/10 border-2 border-green-500/20 text-green-700 p-4 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-500">
          <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center text-white shrink-0">
            <Heart className="h-5 w-5 fill-current" />
          </div>
          <div>
            <p className="font-black uppercase text-sm leading-tight">Congratulations!</p>
            <p className="text-xs font-bold opacity-80 uppercase tracking-wide mt-0.5">You are the winning bidder for this equipment.</p>
          </div>
        </div>
      )}

      {!isWinner && isSeller && auction.status === 'sold' && (
        <div className="bg-primary/10 border-2 border-primary/20 text-primary-foreground p-4 rounded-xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
            <Heart className="h-5 w-5 fill-current" />
          </div>
          <div>
            <p className="font-black uppercase text-sm leading-tight text-primary">Item Sold</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-0.5">Reserve met. Transaction finalization in progress.</p>
          </div>
        </div>
      )}

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
