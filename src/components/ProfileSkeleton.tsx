import { Card, CardContent } from "@/components/ui/card";
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
      className={`max-w-7xl mx-auto animate-pulse ${className ?? ""}`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile Card Skeleton */}
          <Card className="bg-card border-4 border-primary/10 rounded-2xl overflow-hidden">
            <Skeleton className="h-20 bg-primary/20" />
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </CardContent>
          </Card>

          {/* Stats Card Skeleton */}
          <Card className="bg-card border border-primary/10 rounded-2xl">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
              <Skeleton className="h-12 mt-4 rounded-xl" />
            </CardContent>
          </Card>

          {/* Action Buttons Skeleton */}
          <Card className="bg-card border border-primary/10 rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Active Auctions Section */}
          <Card className="bg-card border border-primary/10 rounded-2xl">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AuctionCardSkeleton viewMode="detailed" />
                <AuctionCardSkeleton viewMode="detailed" />
              </div>
            </CardContent>
          </Card>

          {/* Past Sales Section */}
          <Card className="bg-card border border-primary/10 rounded-2xl">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AuctionCardSkeleton viewMode="detailed" />
                <AuctionCardSkeleton viewMode="detailed" />
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity Section */}
          <Card className="bg-card border border-primary/10 rounded-2xl">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-9 flex-1 rounded-lg" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <Skeleton className="h-9 flex-1 rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trust & Compliance Section */}
          <Card className="bg-card border border-primary/10 rounded-2xl">
            <CardContent className="p-6">
              <Skeleton className="h-6 w-44 mb-4" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
