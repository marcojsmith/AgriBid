// app/src/pages/AuctionDetail.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";

import { FeeBreakdown } from "@/components/auction/FeeBreakdown";
import { BidHistory, type BidHistoryRow } from "@/components/ds/BidHistory";
import { BidPanel, type PanelEligibility } from "@/components/ds/BidPanel";
import { Banner } from "@/components/ds/Banner";
import { ConfirmBidSheet } from "@/components/ds/ConfirmBidSheet";
import { CostBox } from "@/components/ds/CostBox";
import { DepositLines } from "@/components/ds/DepositLines";
import { FeesRulesSheet } from "@/components/ds/FeesRulesSheet";
import { TransportQuoteSheet } from "@/components/ds/TransportQuoteSheet";
import { LotChip } from "@/components/ds/LotChip";
import { BackLink, LotNav } from "@/components/ds/LotNav";
import { Money } from "@/components/ds/Money";
import { ReservePill, type ReserveState } from "@/components/ds/ReservePill";
import { SectionHeader } from "@/components/ds/SectionHeader";
import { SellerStrip } from "@/components/ds/SellerStrip";
import { ShareButton } from "@/components/ds/ShareButton";
import { StatusPill } from "@/components/ds/StatusPill";
import { WatchButton } from "@/components/ds/WatchButton";
import { showToast } from "@/components/ds/showToast";
import { HomeLotGrid } from "@/components/home/HomeLotGrid";
import { FlagLotDialog } from "@/components/lot/FlagLotDialog";
import { ConsiderationActions } from "@/components/lot/ConsiderationActions";
import { LotGallery } from "@/components/lot/LotGallery";
import {
  ConditionSection,
  IfYouWinSection,
  LotSection,
  SpecsSection,
  ViewCollect,
} from "@/components/lot/LotSections";
import {
  LotStickyBar,
  type LotStickyAction,
} from "@/components/lot/LotStickyBar";
import { LoadingPage } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/useBranding";
import { useLotBid } from "@/hooks/useLotBid";
import { useLotLiveWindow } from "@/hooks/useLotLiveWindow";
import { useNow } from "@/hooks/useNow";
import { useScrolledPast } from "@/hooks/useScrolledPast";
import { useTransportQuote } from "@/hooks/useTransportQuote";
import { useVatRate } from "@/hooks/useVatRate";
import { useWatchAlerts } from "@/hooks/useWatchAlerts";
import { PermissionPrompt } from "@/components/ds/PermissionPrompt";
import { formatSastDate } from "@/lib/dates";
import { formatLotCount, telLink, whatsappLink } from "@/lib/homeSales";
import {
  buildSlides,
  confirmBreakdown,
  isInExtension,
  lotKeyFacts,
  lotPlace,
  meterPhotoIndex,
  nextMinimumBid,
  premiumPct,
  quickBidAmounts,
  registrationSticky,
  viewerState,
  type RegistrationBlock,
} from "@/lib/lotPage";
import { PROVINCE_LABELS } from "@/lib/provinces";
import {
  buildAuctionDescription,
  buildCanonical,
  buildTitle,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
import { lotTitle } from "@/lib/lotTitle";
import type { ShareResult } from "@/lib/share";
import { isValidCallbackUrl } from "@/lib/utils";
import { getViewSessionId } from "@/lib/viewSession";

/**
 * Maps the server's reserve state to the pill state.
 *
 * @param state - `none`, `applies`, `met` or `not_met`
 * @returns The pill state
 */
function reserveOf(
  state: "none" | "applies" | "met" | "not_met"
): ReserveState {
  return state === "not_met" ? "not-met" : state;
}

/**
 * The lot page (`/auction/:lotId`, design `lot-r4`): back link and lot
 * navigation, the gallery, the title block, the bid panel, bid history,
 * condition, "If you win", specs, "View & collect" and "More in this sale".
 * On desktop the gallery and details sit on the left and the title block, key
 * facts and bid panel stay in a sticky right column. Every bid goes through
 * the confirm sheet; the server validates it. A sticky bar carries the price,
 * time left and the call to action on phones. Records one view per page view.
 *
 * @returns The lot page.
 */
export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  // Local state (amount, sheets, expanded history) belongs to one lot.
  return <LotPage key={id} id={id} />;
}

/**
 * The page body for one lot. See {@link AuctionDetail}.
 *
 * @param props - Component props
 * @param props.id - The lot id from the URL
 * @returns The page
 */
function LotPage({ id }: { id: string | undefined }) {
  const lotId = id as Id<"lots"> | undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const watchAlerts = useWatchAlerts();
  const branding = useBranding();
  const now = useNow(5000);

  const lot = useQuery(
    api.auctions.queries.browse.getLotById,
    lotId ? { lotId } : "skip"
  );
  const settings = useQuery(
    api.admin.platformSettings.getPlatformSettings,
    lotId ? {} : "skip"
  );
  const vatRatePct = useVatRate();
  const sale = useQuery(
    api.auctions.getPublishedAuction,
    lot?.auctionId ? { auctionId: lot.auctionId } : "skip"
  );
  const facets = useQuery(
    api.auctions.getEventFacets,
    lot?.auctionId ? { auctionId: lot.auctionId } : "skip"
  );
  const neighbours = useQuery(
    api.auctions.getLotNeighbours,
    lot && lotId ? { lotId } : "skip"
  );
  const moreLots = useQuery(
    api.auctions.getEventLots,
    lot?.auctionId
      ? { auctionId: lot.auctionId, sort: "lot_number", limit: 5 }
      : "skip"
  );
  const history = useQuery(
    api.auctions.getLotBidHistory,
    lot && lotId ? { lotId } : "skip"
  );
  const myBidState = useQuery(
    api.auctions.getMyLotBidState,
    lot && lotId && isAuthenticated ? { lotId } : "skip"
  );
  // Null while the profile is still being created: treated as loading.
  const bidEligibility = useQuery(
    api.registration.getMyBidEligibility,
    isAuthenticated ? {} : "skip"
  );
  const watchedIds = useQuery(
    api.watchlist.getWatchedLotIds,
    isAuthenticated ? {} : "skip"
  );
  const toggleWatchlist = useMutation(api.watchlist.toggleWatchlist);
  const recordLotView = useMutation(api.engagement.recordLotView);

  const liveWindow = useLotLiveWindow(
    lot ?? {
      status: "draft",
      auctionStatus: undefined,
      auctionStartTime: undefined,
      auctionEndTime: undefined,
      extendedEndTime: undefined,
    }
  );

  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [feesOpen, setFeesOpen] = useState(false);
  const transport = useTransportQuote(lot?._id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ctaRef, ctaGone] = useScrolledPast();

  // One view per page view: the server dedupes repeats within the hour.
  useEffect(() => {
    if (!lotId) return;
    void recordLotView({ lotId, sessionId: getViewSessionId() }).catch(() => {
      // A view is a counter; never bother the visitor if it fails.
    });
  }, [lotId, recordLotView]);

  const minimum = lot
    ? nextMinimumBid({
        currentPrice: lot.currentPrice,
        minIncrement: lot.minIncrement,
        bidCount: lot.bidCount,
      })
    : 0;
  const bid = useLotBid({
    lotId,
    minimum,
    window: lot ?? null,
  });

  const watchedSet = useMemo(
    () => new Set<string>(watchedIds ?? []),
    [watchedIds]
  );

  if (!lotId) {
    return <NotFound />;
  }
  if (lot === undefined || settings === undefined || vatRatePct === undefined) {
    return <LoadingPage message="Loading lot..." />;
  }
  if (lot === null) {
    return <NotFound />;
  }

  const callbackUrl = isValidCallbackUrl(
    `${location.pathname}${location.search}`
  )
    ? encodeURIComponent(`${location.pathname}${location.search}`)
    : "%2F";
  const registerHref = `/login?callbackUrl=${callbackUrl}`;
  const registrationHref = `/register?callbackUrl=${callbackUrl}`;
  const registrationStatusHref = `/register/status?callbackUrl=${callbackUrl}`;

  const title = lotTitle(lot);
  const provinceLabel = lot.province
    ? PROVINCE_LABELS[lot.province]
    : undefined;
  const place = lotPlace(lot.location, provinceLabel);
  const keyFacts = lotKeyFacts({
    year: lot.year,
    operatingHours: lot.operatingHours,
    drive: lot.drive,
    powerKw: lot.powerKw,
    location: lot.location,
    province: provinceLabel,
  });
  const slides = buildSlides(lot.photos, lot.coldStartVideoUrl);
  const meterAt = meterPhotoIndex(slides);

  const telephone = branding?.businessInfo?.telephone?.trim() ?? "";
  const telHref = telLink(telephone);
  const phone = telHref ? { text: telephone, tel: telHref } : undefined;
  const waHref = whatsappLink(branding?.businessInfo?.whatsapp);
  const finance = settings.financeContact;
  const financeTel = telLink(finance.phone);

  const canonical = buildCanonical(`/auction/${lot._id}`);
  const pageTitle = buildTitle(title);
  const description = buildAuctionDescription(
    lot.title,
    lot.year,
    lot.make,
    lot.model,
    place || lot.location
  );
  const ogImage = lot.photos.at(0)?.url ?? DEFAULT_OG_IMAGE;

  const isLive = liveWindow.isLive;
  const isUpcoming = liveWindow.isUpcoming;
  const isEnded = liveWindow.isEnded;
  const isSold = lot.status === "sold";
  // Closed below the reserve; the seller has 48 hours to accept the top bid.
  const isConsidering = lot.status === "under_consideration";
  // The server only sends the reserve to the seller and admins, who may decide.
  const canDecide = lot.isSeller || lot.reservePrice !== undefined;
  const decideBy =
    lot.considerationDeadline !== undefined
      ? formatSastDate(lot.considerationDeadline)
      : undefined;
  const closesAt = liveWindow.effectiveEndTime ?? 0;
  const viewer = viewerState(isAuthenticated, myBidState?.state);
  const extended = isLive && isInExtension(lot, now);
  const premium = premiumPct(lot.buyerPremiumFraction);
  const eligibility: PanelEligibility = bidEligibility ?? { kind: "loading" };
  const registration: RegistrationBlock | undefined =
    eligibility.kind === "ok" || eligibility.kind === "loading"
      ? undefined
      : eligibility;
  const reserve = reserveOf(lot.reserveState);
  const deposit = settings.deposit.enabled
    ? {
        amount: settings.deposit.amount,
        refundDays: settings.deposit.refundDays,
      }
    : undefined;
  const hasBids = lot.bidCount > 0;
  const quick = quickBidAmounts(minimum, lot.minIncrement);

  const historyRows: BidHistoryRow[] = (history?.bids ?? []).map((row) => ({
    id: row._id,
    label: row.label,
    amount: row.amount,
    timestamp: row.timestamp,
    isMine: row.isMine,
  }));

  const handleToggleWatch = async (targetId: Id<"lots">) => {
    if (!isAuthenticated) {
      toast.info("Please sign in to watch a lot");
      void navigate(registerHref);
      return;
    }
    try {
      const watching = await toggleWatchlist({ lotId: targetId });
      if (watching) showToast(await watchAlerts.afterWatch());
      else toast.success("Removed from watchlist");
    } catch {
      toast.error("Failed to update watchlist");
    }
  };
  const handleShare = (result: ShareResult) => {
    if (result === "copied") toast.success("Link copied");
    else if (result === "failed") toast.error("Couldn't share this link");
  };

  const scrollToPanel = () => {
    document
      .getElementById("bidding-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const stickyAction: LotStickyAction | null = lot.isSeller
    ? null
    : viewer === "guest"
      ? { kind: "link", href: registerHref, label: "Register to bid" }
      : eligibility.kind === "loading"
        ? null
        : registration
          ? {
              kind: "link",
              href:
                registration.kind === "incomplete"
                  ? registrationHref
                  : registrationStatusHref,
              label: registrationSticky(registration).cta ?? "Continue",
              ctaVariant: registrationSticky(registration).ctaVariant,
            }
          : viewer === "leading"
            ? { kind: "raise", onRaise: scrollToPanel }
            : {
                kind: "bid",
                amount: minimum,
                onBid: () => {
                  bid.startBid(minimum);
                },
              };

  const breakdown = confirmBreakdown({
    bid: bid.amount,
    premiumFraction: lot.buyerPremiumFraction,
    fixedFees: lot.buyerFixedFees,
    vatRatePct,
    seller: lot.sellerVatKind,
  });

  const moreCards = (moreLots?.lots ?? [])
    .filter((row) => row._id !== lot._id)
    .slice(0, 4);

  const watchActions = (
    <>
      <WatchButton
        watching={watchedSet.has(lot._id)}
        subject={`lot ${String(lot.lotNumber ?? "")}, ${title}`.replace(
          "lot , ",
          "this lot, "
        )}
        onToggle={() => {
          void handleToggleWatch(lot._id);
        }}
      />
      <ShareButton
        title={title}
        text={keyFacts}
        url={canonical}
        onResult={handleShare}
        variant="overlay"
      />
    </>
  );

  const titleBlock = (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {lot.lotNumber !== undefined ? (
          <LotChip number={lot.lotNumber} />
        ) : null}
        {isSold ? (
          <StatusPill outcome="sold" />
        ) : isConsidering ? (
          <StatusPill outcome="under-consideration" />
        ) : isEnded ? (
          <StatusPill outcome="not-sold" />
        ) : (
          <ReservePill state={reserve} />
        )}
      </div>
      <h1 className="mt-2 font-display text-[28px] leading-tight font-semibold lg:text-[32px]">
        {title}
      </h1>
      {keyFacts ? (
        <p className="mt-1 text-[15px] text-muted-foreground">{keyFacts}</p>
      ) : null}
    </div>
  );

  const panel =
    isLive && lot.isSeller ? (
      <section aria-label="Bidding" className="flex flex-col gap-3">
        <Money
          amount={lot.currentPrice}
          label={hasBids ? "Current bid" : "Opening bid"}
          display
        />
        <p className="text-[15px]">
          This is your lot. Sellers can't bid on their own lots.
        </p>
      </section>
    ) : isLive ? (
      <div className="scroll-mt-20">
        <BidPanel
          id="bidding-panel"
          viewer={viewer}
          price={lot.currentPrice}
          bidCount={lot.bidCount}
          watchers={lot.watcherCount}
          closesAt={closesAt}
          extended={extended}
          reserve={reserve}
          cost={{
            bid: minimum,
            seller: lot.sellerVatKind,
            premiumPct: premium,
            fixedFees: lot.buyerFixedFees,
            vatRatePct,
            onFeesClick: () => {
              setFeesOpen(true);
            },
          }}
          deposit={deposit}
          minimum={minimum}
          quickAmounts={quick}
          amount={bid.amount}
          onAmountChange={bid.setAmount}
          onBid={() => {
            bid.startBid();
          }}
          registerHref={registerHref}
          registrationHref={registrationHref}
          registrationStatusHref={registrationStatusHref}
          eligibility={eligibility}
          ctaRef={ctaRef}
        />
      </div>
    ) : isUpcoming ? (
      <section aria-label="Bidding" className="flex flex-col gap-3">
        <Money amount={lot.startingPrice} label="Opening bid" display />
        <p className="text-[15px]">
          <b className="font-bold">
            Opens {formatSastDate(liveWindow.effectiveStartTime ?? 0)}
          </b>
        </p>
        <CostBox
          bid={lot.startingPrice}
          seller={lot.sellerVatKind}
          premiumPct={premium}
          fixedFees={lot.buyerFixedFees}
          vatRatePct={vatRatePct}
          onFeesClick={() => {
            setFeesOpen(true);
          }}
        />
        {deposit && !isAuthenticated ? (
          <DepositLines
            amount={deposit.amount}
            refundDays={deposit.refundDays}
          />
        ) : null}
      </section>
    ) : isConsidering ? (
      <section aria-label="Result" className="flex flex-col gap-3">
        <Money amount={lot.currentPrice} label="Top bid" display />
        <p className="text-sm text-muted-foreground">
          {String(lot.bidCount)} {lot.bidCount === 1 ? "bid" : "bids"} · Under
          consideration
        </p>
        {lot.isWinner ? (
          <Banner kind="info">
            Your bid is with the seller. They have until {decideBy} to accept.
            We&apos;ll notify you either way.
          </Banner>
        ) : null}
        {canDecide ? (
          <>
            <p className="text-[15px]">
              {lot.isSeller
                ? "This closed below your reserve."
                : "This closed below the reserve."}{" "}
              {decideBy ? (
                <b className="font-bold">Decide by {decideBy}.</b>
              ) : null}
            </p>
            <ConsiderationActions
              lotId={lot._id}
              amount={lot.currentPrice}
              deadline={lot.considerationDeadline}
            />
          </>
        ) : null}
        <Button asChild variant="outline" className="w-full">
          <Link to="/auctions">See current auctions</Link>
        </Button>
      </section>
    ) : isEnded ? (
      <section aria-label="Result" className="flex flex-col gap-3">
        {lot.isWinner ? <Banner kind="ok">You won this lot</Banner> : null}
        {isSold || hasBids ? (
          <Money
            amount={lot.currentPrice}
            label={isSold ? "Sold for" : "Highest bid"}
            display
          />
        ) : (
          <p className="text-[15px] text-muted-foreground">
            No bids were placed.
          </p>
        )}
        {hasBids ? (
          <p className="text-sm text-muted-foreground">
            {String(lot.bidCount)} {lot.bidCount === 1 ? "bid" : "bids"} ·{" "}
            {String(lot.watcherCount)} watching
          </p>
        ) : null}
        <Button asChild variant="outline" className="w-full">
          <Link to="/auctions">See current auctions</Link>
        </Button>
      </section>
    ) : (
      <section aria-label="Availability" className="flex flex-col gap-3">
        <Banner kind="info">This lot isn&apos;t open for bidding yet.</Banner>
        <Button asChild variant="outline" className="w-full">
          <Link to="/auctions">See current auctions</Link>
        </Button>
      </section>
    );

  const showViewCollect = !isEnded;
  const openTransport = () => {
    transport.setOpen(true);
  };
  const backLink = sale ? (
    <BackLink to={`/auctions/${sale._id}`}>
      {facets
        ? `${sale.title} · ${formatLotCount(facets.total, facets.capped)}`
        : sale.title}
    </BackLink>
  ) : (
    <BackLink to="/auctions">Auctions</BackLink>
  );

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content="en_ZA" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="robots" content={isLive ? "index, follow" : "noindex"} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: title,
            description,
            image: lot.photos.map((photo) => photo.url),
            brand: { "@type": "Brand", name: lot.make },
            offers: {
              "@type": "Offer",
              url: canonical,
              priceCurrency: "ZAR",
              price: lot.currentPrice,
              availability: isLive
                ? "https://schema.org/InStock"
                : "https://schema.org/SoldOut",
              seller: {
                "@type": "Organization",
                name: SITE_NAME,
                url: SITE_URL,
              },
            },
          })}
        </script>
      </Helmet>

      <div className="container mx-auto max-w-[1200px] px-4 pb-24 md:pb-12">
        <div className="flex flex-col pt-1">
          {backLink}
          <LotNav
            prev={
              neighbours?.prev
                ? {
                    to: `/auction/${neighbours.prev._id}`,
                    number: neighbours.prev.lotNumber,
                  }
                : null
            }
            next={
              neighbours?.next
                ? {
                    to: `/auction/${neighbours.next._id}`,
                    number: neighbours.next.lotNumber,
                  }
                : null
            }
          />
        </div>

        <div className="mt-1 grid gap-y-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-8">
          <LotGallery
            className="lg:col-start-1"
            slides={slides}
            title={title}
            actions={watchActions}
            viewerAt={viewerAt}
            onViewerChange={setViewerAt}
          />

          <aside className="flex flex-col gap-5 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            {titleBlock}
            {panel}
            {showViewCollect ? (
              <div className="hidden lg:block">
                <ViewCollect
                  heading={false}
                  place={place}
                  onTransportClick={openTransport}
                  phone={phone}
                  finance={{
                    name: finance.name,
                    company: finance.company,
                    phone: finance.phone,
                    tel: financeTel,
                  }}
                />
              </div>
            ) : null}
          </aside>

          <div className="flex min-w-0 flex-col gap-6 lg:col-start-1">
            <LotSection title="Bid history">
              <BidHistory
                rows={historyRows}
                total={history?.total ?? lot.bidCount}
                now={now}
                expanded={historyOpen}
                onToggle={() => {
                  setHistoryOpen((open) => !open);
                }}
              />
            </LotSection>

            <ConditionSection
              sellerNotes={lot.conditionChecklist?.notes}
              sellerVatKind={lot.sellerVatKind}
              sellerTypeLabel={lot.sellerTypeLabel}
              reportHref={lot.conditionReportUrl}
              phone={phone}
            />

            {isEnded ? null : <IfYouWinSection deposit={deposit?.amount} />}

            <SpecsSection
              lot={lot}
              onSeeMeter={
                meterAt >= 0
                  ? () => {
                      setViewerAt(meterAt);
                    }
                  : undefined
              }
            />

            {showViewCollect ? (
              <div className="lg:hidden">
                <ViewCollect
                  place={place}
                  onTransportClick={openTransport}
                  phone={phone}
                  finance={{
                    name: finance.name,
                    company: finance.company,
                    phone: finance.phone,
                    tel: financeTel,
                  }}
                />
              </div>
            ) : null}

            {isSold && (lot.isWinner || lot.isSeller) ? (
              <FeeBreakdown
                lotId={lot._id}
                isWinner={lot.isWinner}
                isSeller={lot.isSeller}
                hammerPrice={lot.currentPrice}
                sellerVatKind={lot.sellerVatKind}
              />
            ) : null}
          </div>
        </div>

        {isEnded && waHref ? (
          <SellerStrip
            href={waHref}
            commissionPct={settings.sellerCosts.commissionPct}
            className="-mx-4 mt-8 w-auto border-t md:mx-0 md:rounded-md"
          />
        ) : null}

        {moreCards.length > 0 ? (
          <section aria-label="More in this sale" className="mt-10">
            <SectionHeader title="More in this sale" className="mb-3" />
            <HomeLotGrid
              layout="strip"
              lots={moreCards}
              watchedIds={watchedSet}
              onToggleWatch={(targetId) => {
                void handleToggleWatch(targetId as Id<"lots">);
              }}
              showCloses={false}
              now={now}
            />
          </section>
        ) : null}

        {isAuthenticated && !lot.isSeller ? (
          <div className="mt-8 flex justify-center">
            <FlagLotDialog lotId={lot._id} />
          </div>
        ) : null}
      </div>

      {isLive && stickyAction ? (
        <LotStickyBar
          price={lot.currentPrice}
          hasBids={hasBids}
          closesAt={closesAt}
          viewer={viewer}
          action={stickyAction}
          registration={registration}
          whatsappHref={waHref}
          hidden={!ctaGone}
        />
      ) : null}

      <ConfirmBidSheet
        open={bid.confirmOpen}
        onOpenChange={(open) => {
          if (!open) bid.closeConfirm();
        }}
        lotLabel={`${title}${lot.lotNumber !== undefined ? ` · Lot ${String(lot.lotNumber)}` : ""}`}
        breakdown={breakdown}
        onConfirm={() => {
          void bid.confirm();
        }}
        onReviseBid={bid.reviseBid}
        busy={bid.busy}
        error={bid.error}
      />
      <TransportQuoteSheet
        {...transport.sheetProps}
        lot={{
          label: `${title}${lot.lotNumber !== undefined ? ` � Lot ${String(lot.lotNumber)}` : ""}`,
          place,
        }}
      />
      <FeesRulesSheet
        open={feesOpen}
        onOpenChange={setFeesOpen}
        premiumPct={premium}
        fixedFees={lot.buyerFixedFees}
        vatRatePct={vatRatePct}
        deposit={settings.deposit}
        exampleBid={minimum}
      />
      <PermissionPrompt {...watchAlerts.promptProps} />
    </>
  );
}

/**
 * The state for a lot that doesn't exist or isn't public.
 *
 * @returns The not-found message
 */
function NotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold">Lot not found</h1>
      <p className="text-muted-foreground">
        This lot may not exist or is not yet published.
      </p>
      <Button asChild variant="outline">
        <Link to="/auctions">See all auctions</Link>
      </Button>
    </div>
  );
}
