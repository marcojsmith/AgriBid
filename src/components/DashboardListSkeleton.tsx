import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardListSkeletonProps {
  variant?: "bids" | "listings";
  className?: string;
}

/**
 * A loading skeleton that mirrors the layout of MyBids and MyListings pages.
 *
 * @param props - Component props.
 * @param props.variant - Display variant: "bids" for MyBids, "listings" for MyListings.
 * @param props.className - Additional CSS classes to apply.
 * @returns The rendered skeleton layout.
 */
export function DashboardListSkeleton({
  variant = "bids",
  className,
}: DashboardListSkeletonProps) {
  const isBids = variant === "bids";

  return (
    <div
      role="status"
      aria-label={`Loading ${isBids ? "bids" : "listings"}`}
      className={cn("space-y-8 pb-12 animate-pulse", className)}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-10 w-32" />
        </div>
        {isBids && <Skeleton className="h-11 w-40 rounded-xl" />}
      </div>

      {isBids && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-card/50 border-2">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isBids ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-20 rounded-lg" />
            ))}
            <div className="flex-1" />
            <Skeleton className="h-10 w-44 rounded-lg" />
          </>
        ) : (
          <>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-10 w-24 rounded-lg" />
            ))}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card
            key={i}
            className={cn(
              "overflow-hidden border-2 bg-card h-full shadow-none rounded-lg",
              isBids ? "flex flex-col sm:flex-row sm:h-48" : "flex-col"
            )}
          >
            <div
              className={cn(
                "shrink-0 flex flex-col",
                isBids ? "w-full sm:w-48 md:w-56" : "w-full"
              )}
            >
              <Skeleton
                className={cn(
                  "bg-muted relative overflow-hidden",
                  isBids
                    ? "aspect-[4/3] border-r sm:border-b-0 border-b"
                    : "aspect-video"
                )}
              />
            </div>

            <div className="flex-1 flex flex-col min-w-0 p-5 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>

              <Skeleton className="h-px w-full border-y border-border/5" />

              <div className="flex-1 flex items-end">
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
