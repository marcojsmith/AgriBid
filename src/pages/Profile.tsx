import { useParams, Link } from "react-router-dom";
import { useQuery, usePaginatedQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { api } from "convex/_generated/api";

import { Card, CardContent } from "@/components/ui/card";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";
import { Button } from "@/components/ui/button";
import type { ActivityType } from "@/types/profile";
import {
  ProfileSidebar,
  TrustSection,
  ActivityFeed,
  ReviewsSection,
  ActiveAuctionsSection,
  SalesHistorySection,
} from "@/components/profile";
import { getTrustItems } from "@/lib/profile-utils";
import { useUserProfile } from "@/hooks/useUserProfile";

interface ActivityItem {
  _id: string;
  type: ActivityType;
  description?: string;
  createdAt: number;
}

interface Review {
  _id: string;
  rating: number;
  comment?: string;
  createdAt: number;
  reviewerName?: string;
  response?: {
    text: string;
    createdAt: number;
  };
}

/**
 * Renders a seller profile with account details, listings, reviews, activity, and trust information.
 *
 * Displays loading and user-not-found states when applicable, and provides profile editing for the profile owner or reporting controls for other users.
 *
 * The signed-in user's own profile comes from `UserProfileContext`, which the
 * layout provides, instead of subscribing to `users.getMyProfile` again.
 *
 * @returns The seller profile, loading state, or user-not-found view.
 */
export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const myProfile = useUserProfile();
  const isProfileLoading = myProfile === undefined;
  const isOwner =
    !isProfileLoading &&
    (myProfile?.userId === userId || myProfile?._id === userId);

  const sellerInfo = useQuery(api.auctions.getSellerInfo, {
    sellerId: userId ?? "",
  });

  const watchedAuctionIds = useQuery(api.watchlist.getWatchedLotIds, {});

  const activity = useQuery(api.userActivity.getSellerActivity, {
    userId: userId ?? "",
    limit: 10,
  });

  const {
    results: listings,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getSellerListings,
    { userId: userId ?? "" },
    { initialNumItems: 6 }
  );

  const {
    results: sellerReviews,
    status: reviewsStatus,
    loadMore: loadMoreReviews,
  } = usePaginatedQuery(
    api.reviews.getSellerReviews,
    { sellerId: userId ?? "" },
    { initialNumItems: 5 }
  );

  const { activeListings, soldListings, trustItems } = useMemo(() => {
    if (sellerInfo === undefined || sellerInfo === null) {
      return { activeListings: [], soldListings: [], trustItems: [] };
    }
    const active = listings.filter(
      (l) => l.status === "approved" || l.status === "assigned"
    );
    const sold = listings.filter((l) => l.status === "sold");
    const items = getTrustItems(
      sellerInfo.isVerified,
      sellerInfo.kycStatus,
      {
        emailVerified: sellerInfo.emailVerified,
        phoneVerified: sellerInfo.phoneVerified,
        bankingVerified: sellerInfo.bankingVerified,
        taxNumberVerified: sellerInfo.taxNumberVerified,
      },
      {
        avgRating: sellerInfo.avgRating,
        reviewCount: sellerInfo.reviewCount,
      }
    );
    return { activeListings: active, soldListings: sold, trustItems: items };
  }, [sellerInfo, listings]);

  if (sellerInfo === undefined || status === "LoadingFirstPage") {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <ProfileSkeleton />
      </div>
    );
  }

  if (sellerInfo === null) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-6">
        <h1 className="text-4xl font-bold">User Not Found</h1>
        <p className="text-muted-foreground font-bold">
          The profile you are looking for does not exist or has been
          deactivated.
        </p>
        <Button asChild variant="outline" className="rounded-md border">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 py-4 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 lg:gap-8">
        <ProfileSidebar
          profileData={sellerInfo}
          userId={userId ?? ""}
          isOwner={isOwner}
          initialEditData={
            myProfile?.profile
              ? {
                  bio: myProfile.profile.bio,
                  location: myProfile.profile.location,
                  companyName: myProfile.profile.companyName,
                }
              : undefined
          }
        />

        <main className="space-y-6">
          <ActiveAuctionsSection
            auctions={activeListings}
            status={status}
            watchedIds={watchedAuctionIds}
            userId={userId ?? ""}
          />

          <SalesHistorySection
            auctions={soldListings}
            itemsSold={sellerInfo.itemsSold}
            userId={userId ?? ""}
          />

          <Card className="bg-card border border-primary/10 rounded-md">
            <CardContent className="p-4 sm:p-6">
              <ReviewsSection
                reviewCount={sellerInfo.reviewCount}
                reviews={sellerReviews as Review[]}
                reviewsStatus={reviewsStatus}
                loadMoreReviews={loadMoreReviews}
              />
            </CardContent>
          </Card>

          <Card className="bg-card border border-primary/10 rounded-md">
            <CardContent className="p-4 sm:p-6">
              <ActivityFeed activity={activity as ActivityItem[] | undefined} />
            </CardContent>
          </Card>

          <Card className="bg-card border border-primary/10 rounded-md">
            <CardContent className="p-4 sm:p-6">
              <TrustSection trustItems={trustItems} />
            </CardContent>
          </Card>
        </main>
      </div>

      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="flex flex-col items-center gap-4 pt-4 pb-8">
          <p className="text-xs font-semibold text-muted-foreground">
            Showing {listings.length} of {sellerInfo.totalListings} Listings
          </p>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              loadMore(6);
            }}
            disabled={status === "LoadingMore"}
            className="rounded-md border px-12 font-semibold"
          >
            {status === "LoadingMore" ? (
              <>
                <LoadingIndicator size="sm" className="mr-2" />
                Loading...
              </>
            ) : (
              "Load More Listings"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
