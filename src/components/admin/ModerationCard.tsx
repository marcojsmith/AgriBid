// app/src/components/admin/ModerationCard.tsx
import { Check, X, Clock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  normalizeAuctionImages,
  type AuctionImages,
} from "@/lib/auction-utils";
import { formatCurrency } from "@/lib/currency";
import type { AuctionWithCategory } from "@/types/auction";

import { ConditionItem } from "./ConditionItem";

/**
 * Renders a moderation card for a single auction with actions to approve, reject, or view details.
 *
 * @param root0 - Component props
 * @param root0.auction - Auction document providing images, year, title, make, location, startingPrice, and conditionChecklist
 * @param root0.onApprove - Callback invoked when the Approve button is clicked
 * @param root0.onReject - Callback invoked when the Reject button is clicked
 * @param root0.onView - Callback invoked when the Details button is clicked
 * @returns The moderation card React element
 */
export function ModerationCard({
  auction,
  onApprove,
  onReject,
  onView,
}: {
  auction: AuctionWithCategory;
  onApprove: () => void;
  onReject: () => void;
  onView: () => void;
}) {
  const images = normalizeAuctionImages(
    auction.images as AuctionImages | string[] | undefined
  );
  return (
    <Card className="p-5 border hover:border-primary/40 transition-all bg-card/40 backdrop-blur-md group">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-56 h-40 bg-muted rounded-md border relative overflow-hidden shrink-0">
          {images.front ? (
            <img
              src={images.front}
              className="absolute inset-0 w-full h-full object-cover"
              alt={`${auction.title} - front view`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock className="h-8 w-8 text-muted-foreground/20" />
            </div>
          )}
          <div className="absolute top-2 left-2 px-2 py-0.5 bg-foreground/70 text-background text-xs font-medium rounded-md backdrop-blur-sm border border-border/10">
            {auction.year}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight group-hover:text-primary transition-colors">
                {auction.title}
              </h3>
              <div className="flex gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="font-medium border-primary/20 bg-primary/5 text-primary py-0 h-6 text-xs"
                >
                  {auction.categoryName || "Unknown"}
                </Badge>
                <Badge
                  variant="outline"
                  className="font-medium border py-0 h-6"
                >
                  {auction.make}
                </Badge>
                <Badge
                  variant="outline"
                  className="font-medium border py-0 h-6 text-xs"
                >
                  {auction.location}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground">
                Starting At
              </p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(auction.startingPrice)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 p-3 bg-muted/20 rounded-md border border-dashed">
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
            className="h-10 px-6 rounded-md font-semibold text-xs bg-success hover:bg-success/90 text-success-foreground shadow-lg shadow-success/10"
          >
            <Check className="h-4 w-4 mr-2" /> Approve
          </Button>
          <Button
            onClick={onReject}
            variant="outline"
            className="h-10 px-6 rounded-md font-semibold text-xs border hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4 mr-2" /> Reject
          </Button>
          <Button
            onClick={onView}
            variant="ghost"
            className="h-10 px-6 rounded-md font-medium text-xs opacity-60 hover:opacity-100"
          >
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
}
