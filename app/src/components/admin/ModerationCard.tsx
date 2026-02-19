// app/src/components/admin/ModerationCard.tsx
import { Check, X, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { normalizeAuctionImages, type AuctionImages } from "@/lib/auction-utils";
import { ConditionItem } from "./ConditionItem";
import type { Doc } from "convex/_generated/dataModel";

/**
 * Renders a moderation card for a single auction with actions to approve, reject, or view details.
 *
 * @param auction - Auction document providing images, year, title, make, location, startingPrice, and conditionChecklist
 * @param onApprove - Callback invoked when the Approve button is clicked
 * @param onReject - Callback invoked when the Reject button is clicked
 * @param onView - Callback invoked when the Details button is clicked
 * @returns The moderation card React element
 */
export function ModerationCard({
  auction,
  onApprove,
  onReject,
  onView,
}: {
  auction: Doc<"auctions">;
  onApprove: () => void;
  onReject: () => void;
  onView: () => void;
}) {
  const images = normalizeAuctionImages(
    auction.images as AuctionImages | string[] | undefined,
  );
  return (
    <Card className="p-5 border-2 hover:border-primary/40 transition-all bg-card/40 backdrop-blur-md group">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-56 h-40 bg-muted rounded-xl border-2 relative overflow-hidden shrink-0">
          {images.front ? (
            <img
              src={images.front}
              className="absolute inset-0 w-full h-full object-cover"
              alt=""
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock className="h-8 w-8 text-muted-foreground/20" />
            </div>
          )}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-[9px] font-black uppercase rounded-lg backdrop-blur-sm border border-white/10">
            {auction.year}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight group-hover:text-primary transition-colors">
                {auction.title}
              </h3>
              <div className="flex gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="font-bold border-2 py-0 h-6"
                >
                  {auction.make}
                </Badge>
                <Badge
                  variant="outline"
                  className="font-bold border-2 py-0 h-6 uppercase text-[9px] tracking-wider"
                >
                  {auction.location}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase text-muted-foreground">
                Starting At
              </p>
              <p className="text-xl font-black text-primary">
                R {auction.startingPrice.toLocaleString("en-ZA")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 p-3 bg-muted/20 rounded-xl border-2 border-dashed">
            <ConditionItem
              label="Engine"
              value={auction.conditionChecklist?.engine}
            />
            <ConditionItem
              label="Hydraulics"
              value={auction.conditionChecklist?.hydraulics}
            />
            <ConditionItem
              label="Tires"
              value={auction.conditionChecklist?.tires}
            />
            <ConditionItem
              label="History"
              value={auction.conditionChecklist?.serviceHistory}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 justify-center shrink-0 w-full md:w-auto">
          <Button
            onClick={onApprove}
            className="h-10 px-6 rounded-xl font-black uppercase text-xs bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/10"
          >
            <Check className="h-4 w-4 mr-2" /> Approve
          </Button>
          <Button
            onClick={onReject}
            variant="outline"
            className="h-10 px-6 rounded-xl font-black uppercase text-xs border-2 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4 mr-2" /> Reject
          </Button>
          <Button
            onClick={onView}
            variant="ghost"
            className="h-10 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest opacity-60 hover:opacity-100"
          >
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
}