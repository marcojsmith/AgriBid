import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { formatActivityDate } from "@/lib/profile-utils";

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

interface ReviewsSectionProps {
  /** Total number of reviews for the seller */
  reviewCount: number;
  /** Array of review items */
  reviews: Review[];
  /** Pagination status for reviews */
  reviewsStatus:
    | "LoadingFirstPage"
    | "CanLoadMore"
    | "LoadingMore"
    | "Exhausted";
  /** Function to load more reviews */
  loadMoreReviews: (count: number) => void;
}

/**
 * Renders the Reviews section for a user profile.
 *
 * @param props - Component props
 * @param props.reviewCount - Total number of reviews for the seller
 * @param props.reviews - Array of review items
 * @param props.reviewsStatus - Pagination status for reviews
 * @param props.loadMoreReviews - Function to load more reviews
 * @returns A section with reviews or empty state
 */
export function ReviewsSection({
  reviewCount,
  reviews,
  reviewsStatus,
  loadMoreReviews,
}: ReviewsSectionProps) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <Star className="h-4 w-4 text-warning" />
        <h2 className="text-lg font-black uppercase tracking-wide text-primary">
          Reviews
        </h2>
      </div>

      {reviewCount > 0 ? (
        reviewsStatus === "LoadingFirstPage" ? (
          <LoadingIndicator />
        ) : (
          <div>
            {reviews.map((review) => (
              <div
                key={review._id}
                className="py-4 border-b border-border last:border-0 first:pt-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {review.reviewerName ?? "Anonymous"}
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatActivityDate(review.createdAt)}
                  </p>
                </div>
                <p
                  className="text-warning tracking-widest mt-1"
                  aria-label={`Rated ${String(review.rating)} out of 5 stars`}
                >
                  {"★".repeat(Math.round(review.rating))}
                  {"☆".repeat(5 - Math.round(review.rating))}
                </p>
                {review.comment && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {review.comment}
                  </p>
                )}
                {review.response && (
                  <div className="mt-3 ml-3 border-l-2 border-primary/20 pl-3">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                      Seller response
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {review.response.text}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {(reviewsStatus === "CanLoadMore" ||
              reviewsStatus === "LoadingMore") && (
              <div className="pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    loadMoreReviews(5);
                  }}
                  disabled={reviewsStatus === "LoadingMore"}
                  className="rounded-md border-2 font-black uppercase tracking-widest text-xs"
                >
                  {reviewsStatus === "LoadingMore" ? (
                    <>
                      <LoadingIndicator size="sm" className="mr-2" />
                      Loading...
                    </>
                  ) : (
                    "Load More Reviews"
                  )}
                </Button>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="border-2 border-dashed border-border rounded p-8 text-center">
          <p className="text-muted-foreground font-bold uppercase tracking-widest italic text-sm">
            No reviews yet.
          </p>
        </div>
      )}
    </section>
  );
}
