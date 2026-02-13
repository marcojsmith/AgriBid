// app/src/components/AuctionHeader.tsx
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, HardDrive } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";

interface AuctionHeaderProps {
  auction: Doc<"auctions">;
}

export const AuctionHeader = ({ auction }: AuctionHeaderProps) => {
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
      
      <h1 className="text-4xl md:text-5xl font-black tracking-tight text-primary uppercase leading-tight">
        {auction.title}
      </h1>

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
