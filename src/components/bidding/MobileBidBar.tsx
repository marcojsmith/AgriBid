// app/src/components/bidding/MobileBidBar.tsx
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";

import type { LotDetail } from "@/types/auction";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { formatCurrency } from "@/lib/currency";
import { useLotLiveWindow } from "@/hooks/useLotLiveWindow";

interface MobileBidBarProps {
  /** The lot detail to display the current price and status for */
  auction: LotDetail;
}

/**
 * Persistent bottom bar for mobile viewports showing the current bid and the
 * primary bidding action. Hidden on `lg` screens where the sticky desktop
 * bidding panel is visible instead.
 *
 * Behavior:
 * - Ended/closed lots show a status label with no action.
 * - Not-yet-assigned lots show a "not yet available" label with no action.
 * - Logged-in, unverified users get a "Verify to bid" link to `/kyc`.
 * - Everyone else gets a "Place bid" button that scrolls to the bidding panel.
 *
 * @param props - Component props
 * @param props.auction - The lot detail
 * @returns The rendered mobile bid bar
 */
export const MobileBidBar = ({ auction }: MobileBidBarProps) => {
  const { data: session } = useSession();
  const userData = useQuery(api.users.getMyProfile);

  const liveWindow = useLotLiveWindow(auction);

  // Mirrors BiddingPanel's verification checks: only treat the user as
  // unverified once the profile query has actually resolved
  const isProfileLoading = userData === undefined;
  const isVerified = isProfileLoading
    ? false
    : (userData?.profile?.isVerified ?? false);
  const needsVerification =
    !isProfileLoading && !isVerified && !!session && liveWindow.isLive;

  /**
   * Scrolls the page to the desktop bidding panel where the existing
   * sign-in/verification flows take over.
   */
  const scrollToBiddingPanel = () => {
    document
      .getElementById("bidding-panel")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      data-testid="mobile-bid-bar"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Current bid
          </p>
          <p className="text-lg font-semibold tabular-nums text-primary whitespace-nowrap">
            {formatCurrency(auction.currentPrice)}
          </p>
        </div>

        {liveWindow.isEnded ? (
          <span className="text-sm font-medium text-muted-foreground shrink-0">
            {auction.status === "assigned"
              ? "Auction ended"
              : `Auction ${auction.status}`}
          </span>
        ) : liveWindow.isUnavailable ? (
          <span className="text-sm font-medium text-muted-foreground shrink-0">
            Not yet available
          </span>
        ) : needsVerification ? (
          <Button className="shrink-0 rounded-md font-semibold" asChild>
            <Link to="/kyc">Verify to bid</Link>
          </Button>
        ) : (
          <Button
            className="shrink-0 rounded-md font-semibold"
            onClick={scrollToBiddingPanel}
          >
            Place bid
          </Button>
        )}
      </div>
    </div>
  );
};
