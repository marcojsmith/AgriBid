import { Link } from "react-router-dom";
import { Gavel, Award } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AuctionCard } from "@/components/auction/AuctionCard";
import type { LotSummary } from "@/types/auction";

interface ActiveAuctionsSectionProps {
  /** Array of active auction items */
  auctions: LotSummary[];
  /** Pagination status */
  status: string;
  /** Array of watched auction IDs */
  watchedIds: string[] | undefined;
  /** The profile user's ID for the "View all" link */
  userId: string;
}

interface SalesHistorySectionProps {
  /** Array of sold auction items */
  auctions: LotSummary[];
  /** Total number of items sold */
  itemsSold: number;
  /** The profile user's ID for the "View all" link */
  userId: string;
}

/**
 * Renders the Active Auctions section.
 *
 * @param props - Component props
 * @param props.auctions - Array of active auction items
 * @param props.status - Pagination status
 * @param props.watchedIds - Array of watched auction IDs
 * @param props.userId - The profile user's ID for the "View all" link
 * @returns A section with active auction cards
 */
export function ActiveAuctionsSection({
  auctions,
  status,
  watchedIds,
  userId,
}: ActiveAuctionsSectionProps) {
  return (
    <Card className="bg-card border border-primary/10 rounded-md">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-bold text-primary">Active Auctions</h2>
          </div>
          <Link
            to={`/sellers/${userId}/listings`}
            className="text-xs font-bold text-primary hover:underline"
          >
            View all →
          </Link>
        </div>

        {auctions.length === 0 && status === "Exhausted" ? (
          <div className="border border-dashed border-border rounded p-12 text-center">
            <p className="text-4xl mb-3" aria-hidden="true">
              🚜
            </p>
            <p className="text-muted-foreground font-bold italic text-sm">
              No active auctions at this time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {auctions.map((auction) => (
              <AuctionCard
                key={auction._id}
                auction={auction}
                isWatched={watchedIds?.includes(auction._id) ?? false}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Renders the Sales History section.
 *
 * @param props - Component props
 * @param props.auctions - Array of sold auction items
 * @param props.itemsSold - Total number of items sold
 * @param props.userId - The profile user's ID for the "View all" link
 * @returns A section with sales history cards
 */
export function SalesHistorySection({
  auctions,
  itemsSold,
  userId,
}: SalesHistorySectionProps) {
  if (itemsSold === 0) return null;

  return (
    <Card className="bg-card border border-primary/10 rounded-md">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-success" />
            <h2 className="text-lg font-bold text-success">Sales History</h2>
          </div>
          <Link
            to={`/sellers/${userId}/listings/sold`}
            className="text-xs font-bold text-success hover:underline"
          >
            View all →
          </Link>
        </div>

        {auctions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {auctions.map((auction) => (
              <AuctionCard
                key={auction._id}
                auction={auction}
                isWatched={false}
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border rounded p-8 text-center">
            <p className="text-muted-foreground font-bold italic text-sm">
              View all sold listings →
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
