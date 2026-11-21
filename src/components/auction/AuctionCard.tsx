// app/src/components/auction/AuctionCard.tsx
import React, { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Heart, MapPin } from "lucide-react";

import { useSession } from "@/lib/auth-client";
import { getLotLiveWindow, useLotLiveWindow } from "@/hooks/useLotLiveWindow";
import { useNow } from "@/hooks/useNow";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { BidConfirmation } from "@/components/BidConfirmation";
import { Countdown } from "@/components/ds/Countdown";
import { Money } from "@/components/ds/Money";
import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { ReservePill, type ReserveState } from "@/components/ds/ReservePill";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { deriveDisplayStatus } from "@/lib/auction-badges";
import { formatCurrency } from "@/lib/currency";
import { getLotCta, type LotCtaPhase } from "@/lib/lotCta";
import { PROVINCE_LABELS } from "@/lib/provinces";
import { isValidCallbackUrl, cn, getErrorMessage } from "@/lib/utils";
import type { LotSummary } from "@/types/auction";

interface AuctionCardProps {
  auction: LotSummary;
  viewMode?: "compact" | "detailed";
  isWatched?: boolean;
}

/**
 * Reserve state for the pill: no reserve, met once the price reaches it, else
 * not met.
 *
 * @param lot - The lot to read
 * @returns The reserve state
 */
function reserveStateOf(lot: LotSummary): ReserveState {
  if (lot.reservePrice <= 0) return "none";
  return lot.currentPrice >= lot.reservePrice ? "met" : "not-met";
}

/**
 * One lot in the auction event grid and other lot lists: photo, "LOT n ·
 * category" eyebrow, make/model title, hours and place, price with reserve
 * pill, countdown and one state-correct call to action (at least 44px tall).
 *
 * `detailed` stacks photo over text; `compact` is a row with a 4:3 thumbnail.
 * The title link covers the whole card; the watch and bid buttons sit above it.
 * The label ("Opening bid" or "Current bid") follows whether the price has
 * moved above the opening price.
 *
 * @param props - Component props
 * @param props.auction - The lot summary to show
 * @param props.viewMode - Visual mode (compact or detailed)
 * @param props.isWatched - Whether the lot is on the user's watchlist
 * @returns The rendered lot card
 */
export const AuctionCard = ({
  auction,
  viewMode = "detailed",
  isWatched: initialIsWatched = false,
}: AuctionCardProps) => {
  const { data: session } = useSession();
  const userProfile = useUserProfile();
  const navigate = useNavigate();
  const now = useNow();
  const placeBid = useMutation(api.auctions.mutations.bidding.placeBid);
  const toggleWatchlist = useMutation(api.watchlist.toggleWatchlist);
  const [isBidding, setIsBidding] = useState(false);
  const isBiddingRef = useRef(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const liveWindow = useLotLiveWindow(auction);

  // Re-sync local state when the prop changes (state-during-render pattern).
  const [prevInitialIsWatched, setPrevInitialIsWatched] =
    useState(initialIsWatched);
  if (prevInitialIsWatched !== initialIsWatched) {
    setPrevInitialIsWatched(initialIsWatched);
    setIsWatched(initialIsWatched);
  }

  const lotPath = `/auction/${auction._id}`;

  const goToLogin = () => {
    const callbackUrl = isValidCallbackUrl(lotPath)
      ? encodeURIComponent(lotPath)
      : "/";
    void navigate(`/login?callbackUrl=${callbackUrl}`);
  };

  const handleWatchlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session) {
      toast.info("Please sign in to watch an auction");
      goToLogin();
      return;
    }

    try {
      const nowWatched = await toggleWatchlist({ lotId: auction._id });
      setIsWatched(nowWatched);
      toast.success(
        nowWatched ? "Added to watchlist" : "Removed from watchlist"
      );
    } catch {
      toast.error("Failed to update watchlist");
    }
  };

  const nextBid = auction.currentPrice + auction.minIncrement;
  const phase: LotCtaPhase = liveWindow.phase;
  // Verification only matters once the profile has loaded for a signed-in user.
  const isVerified =
    session && userProfile !== undefined
      ? (userProfile?.profile?.isVerified ?? false)
      : undefined;
  const cta = getLotCta({
    phase,
    signedIn: !!session,
    isVerified,
    nextBid,
  });

  const handleBidInitiate = () => {
    const window = getLotLiveWindow(auction, Date.now());
    if (!window.isLive) {
      toast.error("This auction is not open for bidding");
      return;
    }
    if (!session) {
      toast.info("Please sign in to place a bid");
      goToLogin();
      return;
    }
    setPendingBid(nextBid);
    setIsConfirmOpen(true);
  };

  const handleBidConfirm = async () => {
    if (pendingBid === null || isBiddingRef.current) return;

    const minimum = auction.currentPrice + auction.minIncrement;
    if (pendingBid < minimum) {
      toast.error(
        `Price updated to ${formatCurrency(minimum)} due to a newer bid.`
      );
      setPendingBid(minimum);
      return;
    }

    isBiddingRef.current = true;
    setIsConfirmOpen(false);
    setIsBidding(true);
    try {
      await placeBid({ lotId: auction._id, amount: pendingBid });
      toast.success("Bid placed successfully!");
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "Failed to place bid"));
    } finally {
      setIsBidding(false);
      isBiddingRef.current = false;
      setPendingBid(null);
    }
  };

  const { images } = auction;
  const primaryImage =
    images.front ??
    images.engine ??
    images.cabin ??
    images.rear ??
    images.additional[0];

  const isCompact = viewMode === "compact";
  const isEnded = liveWindow.isEnded;
  const isUpcoming = liveWindow.isUpcoming;
  const name = `${String(auction.year)} ${auction.make} ${auction.model}`;
  const place = auction.province
    ? PROVINCE_LABELS[auction.province]
    : auction.location;
  const hasBids = auction.currentPrice > auction.startingPrice;
  const moneyLabel =
    auction.status === "sold"
      ? "Sold for"
      : hasBids
        ? auction.status === "unsold"
          ? "Highest bid"
          : "Current bid"
        : "Opening bid";
  const eyebrow =
    auction.lotNumber === undefined
      ? auction.categoryName
      : `Lot ${String(auction.lotNumber)} · ${auction.categoryName}`;

  const displayStatus = deriveDisplayStatus({
    startTime: liveWindow.effectiveStartTime,
    endTime: liveWindow.effectiveEndTime,
    now,
    outcome:
      auction.status === "sold"
        ? "sold"
        : isEnded || auction.status === "unsold"
          ? "passed"
          : null,
  });

  const ctaClasses = "min-h-11 flex-1 font-semibold";
  const ctaButton =
    cta.kind === "bid" ? (
      <Button
        type="button"
        className={ctaClasses}
        onClick={handleBidInitiate}
        disabled={isBidding}
      >
        {isBidding ? "Placing bid…" : cta.label}
      </Button>
    ) : (
      <Button
        asChild
        variant={
          cta.kind === "result" || cta.kind === "view" ? "outline" : "default"
        }
        className={ctaClasses}
      >
        {cta.kind === "register" ? (
          <Link to={`/login?callbackUrl=${encodeURIComponent(lotPath)}`}>
            {cta.label}
          </Link>
        ) : cta.kind === "verify" ? (
          <Link to="/kyc">{cta.label}</Link>
        ) : (
          <Link to={lotPath}>{cta.label}</Link>
        )}
      </Button>
    );

  const countdown =
    isEnded || phase === "unavailable" ? null : (
      <span className="flex flex-col items-end text-right">
        <span className="text-[13px] text-muted-foreground">
          {isUpcoming ? "Opens in" : "Closes in"}
        </span>
        <Countdown
          endTime={
            isUpcoming
              ? liveWindow.effectiveStartTime
              : liveWindow.effectiveEndTime
          }
        />
      </span>
    );

  return (
    <article
      data-slot="lot-card"
      data-view-mode={viewMode}
      className={cn(
        "relative flex h-full overflow-hidden rounded-md border border-border bg-card",
        isCompact ? "flex-row" : "flex-col"
      )}
    >
      <div
        className={cn(
          "relative shrink-0",
          isCompact ? "w-28 self-start sm:w-40" : "w-full"
        )}
      >
        <PhotoFrame
          src={primaryImage}
          alt={primaryImage ? "" : `${name}, no photo yet`}
          ratio="4:3"
          className={cn("rounded-none", isCompact && "aspect-[4/3]")}
        />
        <div className="absolute left-2 top-2">
          <StatusBadge status={displayStatus} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 md:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
        <h3
          className={cn(
            "leading-snug",
            isCompact ? "text-base" : "text-[19px]"
          )}
        >
          <Link
            to={lotPath}
            className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {name}
          </Link>
        </h3>
        <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="num">
            {auction.operatingHours.toLocaleString("en-ZA")} hrs
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{place}</span>
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1.5">
          <div className="flex flex-col items-start gap-1">
            <Money
              label={moneyLabel}
              amount={hasBids ? auction.currentPrice : auction.startingPrice}
            />
            {!isEnded && phase !== "unavailable" ? (
              <ReservePill state={reserveStateOf(auction)} />
            ) : null}
          </div>
          {countdown}
        </div>

        <div className="relative z-10 flex items-center gap-2 pt-1">
          {ctaButton}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label={
              isWatched
                ? `Remove ${name} from watchlist`
                : `Add ${name} to watchlist`
            }
            aria-pressed={isWatched}
            onClick={handleWatchlistToggle}
          >
            <Heart
              aria-hidden="true"
              className={cn("size-5", isWatched && "fill-current")}
            />
          </Button>
        </div>
      </div>

      <BidConfirmation
        isOpen={isConfirmOpen}
        amount={pendingBid ?? 0}
        onConfirm={handleBidConfirm}
        onCancel={() => {
          setIsConfirmOpen(false);
          setPendingBid(null);
        }}
      />
    </article>
  );
};
