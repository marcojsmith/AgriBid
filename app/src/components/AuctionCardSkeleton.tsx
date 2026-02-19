import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuctionCardSkeletonProps {
  viewMode?: "compact" | "detailed";
}

export const AuctionCardSkeleton = ({
  viewMode = "detailed",
}: AuctionCardSkeletonProps) => {
  const isCompact = viewMode === "compact";

  return (
    <Card
      aria-hidden="true"
      className={cn(
        "overflow-hidden border-2 bg-card h-full shadow-none animate-pulse rounded-lg",
      )}
    >
      <div className={cn("flex h-full", isCompact ? "flex-row" : "flex-col")}>
        {/* Left Side (Compact) / Top Side (Detailed) */}
        <div
          className={cn(
            "shrink-0 flex flex-col",
            isCompact ? "w-[120px] sm:w-[160px] md:w-[180px]" : "w-full",
          )}
        >
          <div
            className={cn(
              "bg-muted relative overflow-hidden",
              isCompact ? "flex-1 border-r" : "aspect-video",
            )}
          />

          {/* Timer area placeholder - Under Image (Compact) */}
          {isCompact && (
            <div className="h-12 border-t border-r bg-muted/30 flex items-center justify-center px-4">
              <div className="h-4 bg-muted rounded w-full" />
            </div>
          )}
        </div>

        {/* Right Side (Compact) / Bottom Side (Detailed) */}
        <div className="flex-1 flex flex-col min-w-0">
          <CardHeader
            className={cn(isCompact ? "p-3 pb-1" : "p-4 md:p-5 pb-0 md:pb-0")}
          >
            {/* Title placeholders */}
            <div className="space-y-2">
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-5 bg-muted rounded w-1/2" />
            </div>

            {isCompact ? (
              /* Description placeholders (Compact) */
              <div className="space-y-1.5 mt-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            ) : (
              /* Metadata row placeholders (Detailed) */
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
                <div className="flex items-center gap-1">
                  <div className="h-4 w-4 bg-muted rounded-full" />
                  <div className="h-4 bg-muted rounded w-24" />
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-4 w-4 bg-muted rounded-full" />
                  <div className="h-4 bg-muted rounded w-16" />
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent
            className={cn(
              "flex-1 flex flex-col justify-end pt-0 md:pt-0",
              isCompact ? "p-3" : "p-4 md:p-5",
            )}
          >
            {!isCompact && (
              /* Price/Timer row placeholders (Detailed) */
              <div className="flex justify-between items-end mt-4">
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-16" />
                  <div className="h-8 bg-muted rounded w-32" />
                </div>
                <div className="space-y-2 flex flex-col items-end">
                  <div className="h-3 bg-muted rounded w-12" />
                  <div className="h-5 bg-muted rounded w-20" />
                </div>
              </div>
            )}
          </CardContent>

          {/* Action Footer placeholder */}
          <div
            className={cn(
              "bg-muted/20 border-t flex gap-2 items-center",
              isCompact ? "p-3 h-12" : "p-4 md:p-5",
            )}
          >
            <div
              className={cn(
                "flex-1 bg-muted",
                isCompact ? "h-8 rounded-lg" : "h-11 rounded-xl",
              )}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};
