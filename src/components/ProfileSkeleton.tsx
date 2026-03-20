import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AuctionCardSkeleton } from "@/components/AuctionCardSkeleton";

interface ProfileSkeletonProps {
  className?: string;
}

/**
 * A loading skeleton that mirrors the Profile page layout.
 *
 * @param props - Component props.
 * @param props.className - Additional CSS classes to apply.
 * @returns The rendered skeleton layout.
 */
export function ProfileSkeleton({ className }: ProfileSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading profile"
      className={`max-w-7xl mx-auto space-y-12 animate-pulse ${className ?? ""}`}
    >
      <Card className="bg-card border-4 border-primary/10 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl shadow-primary/5">
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
          <Skeleton className="h-32 w-32 rounded-[2rem]" />

          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-8 w-36 rounded-lg" />
              </div>
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-4">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-6 pt-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1">
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-3 border-l-2 border-primary/10 pl-6">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1">
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <AuctionCardSkeleton key={i} viewMode="detailed" />
          ))}
        </div>
      </div>
    </div>
  );
}
