// app/src/pages/AuctionContainerDetail.tsx
import { useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Helmet } from "react-helmet-async";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { AddToHomeScreenSheet } from "@/components/ds/AddToHomeScreenSheet";
import { BeforeYouBid } from "@/components/ds/BeforeYouBid";
import { FeesRulesSheet } from "@/components/ds/FeesRulesSheet";
import { PermissionPrompt } from "@/components/ds/PermissionPrompt";
import { SellerStrip } from "@/components/ds/SellerStrip";
import { StickyBar } from "@/components/ds/StickyBar";
import { showToast } from "@/components/ds/showToast";
import { EventHeader } from "@/components/event/EventHeader";
import { SortControl } from "@/components/event/SortControl";
import { HomeFilters, type PriceFilter } from "@/components/home/HomeFilters";
import { HomeLotGrid } from "@/components/home/HomeLotGrid";
import { LoadingPage } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/useBranding";
import { useNow } from "@/hooks/useNow";
import { useScrolledPast } from "@/hooks/useScrolledPast";
import { URGENT_MS } from "@/lib/auction-badges";
import { getEventBucket } from "@/lib/auction-utils";
import { WATCHING_MESSAGE } from "@/lib/auctionRules";
import { formatClosesIn, formatRemaining } from "@/lib/countdown";
import { formatSastDate } from "@/lib/dates";
import type { EventSort } from "@/lib/eventPage";
import { formatLotCount, whatsappLink } from "@/lib/homeSales";
import { browserNeedsHomeScreenInstall } from "@/lib/homeScreen";
import { requestReminderPermission } from "@/lib/reminders";
import {
  buildCanonical,
  buildTitle,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";
import { lotTitle, lotTitleWithYear } from "@/lib/lotTitle";
import type { ShareResult } from "@/lib/share";

/** Lots added by each "Show more" tap. */
const PAGE_SIZE = 24;

/** Closed-sale filter keys (they replace the category chips). */
type OutcomeKey = "sold" | "not_sold" | "under_consideration";

/** Everything the lot list depends on; a change resets the page count. */
interface Filters {
  category: string | null;
  make: string | null;
  price: PriceFilter;
  outcome: OutcomeKey | null;
  sort: EventSort;
}

const NO_FILTERS: Filters = {
  category: null,
  make: null,
  price: {},
  outcome: null,
  sort: "lot_number",
};

/**
 * Public page for one auction (`event-r4`): the sale header, a lot browser
 * scoped to the sale (search, category chips, price, makes, sort, "Show 24
 * more"), the seller strip, "Before you bid" and, on phones once the header
 * scrolls away, a sticky bar. It covers live, upcoming and closed sales and
 * the signed-in state. Every date, count and price comes from data, the shared
 * formatters and `auctionRules`. Drafts resolve to a not-found state.
 *
 * @returns The AuctionContainerDetail page component.
 */
export default function AuctionContainerDetail() {
  const { id } = useParams<{ id: string }>();
  // Filters and the page count belong to one sale: remount when it changes.
  return <EventPage key={id} id={id} />;
}

/**
 * The page body for one sale. See {@link AuctionContainerDetail}.
 *
 * @param props - Component props
 * @param props.id - The auction id from the URL
 * @returns The page
 */
function EventPage({ id }: { id: string | undefined }) {
  const auctionId = id as Id<"auctions"> | undefined;
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const branding = useBranding();
  // Ticks every 5 s so the seconds in the last 10 minutes stay current.
  const now = useNow(5000);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearch = searchParams.get("q") ?? "";
  // The box is typed into without waiting for the URL (a slow router update
  // would drop characters); a search sent from the header arrives as `?q=`.
  const [search, setSearchText] = useState(urlSearch);
  const [seenUrlSearch, setSeenUrlSearch] = useState(urlSearch);
  if (urlSearch !== seenUrlSearch) {
    setSeenUrlSearch(urlSearch);
    setSearchText(urlSearch);
  }

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [pages, setPages] = useState({ key: "", count: 1 });
  const [feesOpen, setFeesOpen] = useState(false);
  const [sheet, setSheet] = useState<"home-screen" | "permission" | null>(null);
  const [ctaRef, ctaGone] = useScrolledPast();

  const auction = useQuery(
    api.auctions.getPublishedAuction,
    auctionId ? { auctionId } : "skip"
  );
  const settings = useQuery(
    api.admin.platformSettings.getPlatformSettings,
    auctionId ? {} : "skip"
  );
  const facets = useQuery(
    api.auctions.getEventFacets,
    auctionId && auction ? { auctionId } : "skip"
  );
  const featuredRows = useQuery(
    api.engagement.getMostEngagedLots,
    auctionId && auction ? { auctionId, limit: 1 } : "skip"
  );

  const searchText = search.trim().slice(0, 60);
  // A sale that closes while the page is open swaps its category, make and
  // price chips for outcome chips; the hidden filters must stop applying.
  const closedNow =
    auction !== undefined &&
    auction !== null &&
    getEventBucket(auction, now) === "closed";
  const applied: Filters = closedNow
    ? { ...NO_FILTERS, outcome: filters.outcome, sort: filters.sort }
    : { ...filters, outcome: null };
  const filterKey = JSON.stringify([applied, searchText]);
  const pageCount = pages.key === filterKey ? pages.count : 1;
  const limit = pageCount * PAGE_SIZE;
  const latestLots = useQuery(
    api.auctions.getEventLots,
    auctionId && auction
      ? {
          auctionId,
          search: searchText === "" ? undefined : searchText,
          categoryId: (applied.category ?? undefined) as
            Id<"equipmentCategories"> | undefined,
          make: applied.make ?? undefined,
          minPrice: applied.price.min,
          maxPrice: applied.price.max,
          outcome:
            applied.outcome === "sold" || applied.outcome === "not_sold"
              ? applied.outcome
              : undefined,
          sort: applied.sort,
          limit,
        }
      : "skip"
  );

  // Keep the previous list on screen while the next one loads, so a sort,
  // filter or "Show more" does not flash a loading state or lose the scroll.
  const [keptLots, setKeptLots] = useState(latestLots);
  const [pinnedExample, setPinnedExample] = useState<{
    title: string;
    bid: number;
  } | null>(null);
  if (latestLots !== undefined && latestLots !== keptLots) {
    setKeptLots(latestLots);
  }
  const lotsResult = latestLots ?? keptLots;

  const watchedIds = useQuery(
    api.watchlist.getWatchedLotIds,
    isAuthenticated ? {} : "skip"
  );
  const watchedSet = useMemo(
    () => new Set<string>(watchedIds ?? []),
    [watchedIds]
  );
  const toggleWatchlist = useMutation(api.watchlist.toggleWatchlist);

  if (auction === undefined || (auctionId && settings === undefined)) {
    return <LoadingPage message="Loading auction..." />;
  }

  if (auction === null || !auctionId || settings === undefined) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">
          Auction not found
        </h1>
        <p className="text-muted-foreground">
          This auction may not exist or is not yet published.
        </p>
        <Button asChild variant="outline">
          <Link to="/auctions">See all auctions</Link>
        </Button>
      </div>
    );
  }

  const bucket = getEventBucket(auction, now);
  const closed = bucket === "closed";
  const upcoming = bucket === "upcoming";
  // The sale's own premium is stored as a fraction, the setting as a percent.
  const premiumPct =
    auction.defaultBuyerPremiumPct !== undefined
      ? Number((auction.defaultBuyerPremiumPct * 100).toFixed(4))
      : settings.buyerPremiumPct;
  const waHref = whatsappLink(branding?.businessInfo?.whatsapp);
  const canonical = buildCanonical(`/auctions/${auction._id}`);
  const pageTitle = buildTitle(auction.title);
  const description = auction.description ?? DEFAULT_DESCRIPTION;

  const featuredRow = featuredRows?.[0];
  const firstLot = lotsResult?.lots[0];
  const candidate = featuredRow
    ? {
        title: lotTitleWithYear(featuredRow.lot),
        bid:
          featuredRow.bids > 0
            ? featuredRow.lot.currentPrice
            : featuredRow.lot.startingPrice,
      }
    : firstLot
      ? {
          title: lotTitle(firstLot),
          bid:
            firstLot.bids > 0 ? firstLot.currentPrice : firstLot.startingPrice,
        }
      : null;
  // Pin the cost box example: a sort or filter must not change it.
  if (pinnedExample === null && candidate !== null) {
    setPinnedExample(candidate);
  }
  const example = featuredRow ? candidate : pinnedExample;

  const outcomes = facets?.outcomes;
  const outcomeOptions = outcomes
    ? [
        { key: "sold", label: "Sold", count: outcomes.sold },
        { key: "not_sold", label: "Not sold", count: outcomes.notSold },
        {
          key: "under_consideration",
          label: "Under consideration",
          count: outcomes.underConsideration,
        },
      ].filter((option) => option.count > 0)
    : [];
  const categoryOptions = (facets?.categories ?? []).map((c) => ({
    key: c.categoryId,
    label: c.name,
    count: c.count,
  }));
  const makeOptions = (facets?.makes ?? []).map((m) => ({
    key: m.make,
    label: m.make,
    count: m.count,
  }));

  const update = (next: Partial<Filters>) => {
    setFilters({ ...filters, ...next });
  };
  const setSearch = (text: string) => {
    setSearchText(text);
  };
  const clearFilters = () => {
    setFilters(NO_FILTERS);
    setSearchText("");
    if (urlSearch !== "") {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          next.delete("q");
          return next;
        },
        { replace: true }
      );
    }
  };

  const handleToggleWatch = async (lotId: string) => {
    if (!isAuthenticated) {
      toast.info("Please sign in to watch a lot");
      void navigate(
        `/login?callbackUrl=${encodeURIComponent(`/auctions/${auction._id}`)}`
      );
      return;
    }
    try {
      const watching = await toggleWatchlist({ lotId: lotId as Id<"lots"> });
      if (watching) showToast(WATCHING_MESSAGE);
      else toast.success("Removed from watchlist");
    } catch {
      toast.error("Failed to update watchlist");
    }
  };

  const handleShare = (result: ShareResult) => {
    if (result === "copied") toast.success("Link copied");
    else if (result === "failed") toast.error("Couldn't share this link");
  };

  const handleRemind = () => {
    setSheet(browserNeedsHomeScreenInstall() ? "home-screen" : "permission");
  };
  const handleAllow = () => {
    setSheet(null);
    void requestReminderPermission().then((result) => {
      if (result === "granted") {
        toast.success(
          "Notifications allowed. We'll remind you when this sale opens."
        );
      } else if (result === "denied") {
        toast.error("Notifications are blocked in your browser settings.");
      } else {
        toast.error("This browser can't show notifications.");
      }
    });
  };

  const matched = lotsResult?.matched ?? 0;
  const shown = lotsResult?.lots.length ?? 0;
  const remaining = matched - shown;
  const lots = lotsResult?.lots ?? [];
  const filtersOn =
    applied.category !== null ||
    applied.make !== null ||
    applied.outcome !== null ||
    applied.price.min !== undefined ||
    applied.price.max !== undefined ||
    searchText !== "";

  const showSticky = ctaGone && !closed;
  const stickyTitle = upcoming
    ? `Opens in ${formatRemaining(Math.max(auction.startTime - now, 1000))}`
    : formatClosesIn(auction.effectiveEndTime - now);
  const stickySub = formatSastDate(
    upcoming ? auction.startTime : auction.effectiveEndTime
  );

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta
          property="og:image"
          content={auction.bannerImageUrl ?? DEFAULT_OG_IMAGE}
        />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <nav
        aria-label="Back"
        className="container mx-auto max-w-[1200px] px-4 py-2.5"
      >
        <Link
          to="/auctions"
          className="inline-flex min-h-11 items-center gap-1 text-[15px] font-medium"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Auctions
        </Link>
      </nav>

      <EventHeader
        sale={{
          title: auction.title,
          startTime: auction.startTime,
          endTime: auction.endTime,
          effectiveEndTime: auction.effectiveEndTime,
          bucket,
        }}
        now={now}
        example={example}
        premiumPct={premiumPct}
        deposit={settings.deposit}
        signedIn={isAuthenticated}
        closed={
          closed && facets
            ? {
                sold: facets.outcomes.sold,
                total: facets.total,
                soldTotal: facets.outcomes.soldTotal,
                underConsideration: facets.outcomes.underConsideration,
              }
            : null
        }
        onRemind={
          upcoming && settings.pushRemindersEnabled ? handleRemind : undefined
        }
        onFeesClick={() => {
          setFeesOpen(true);
        }}
        shareUrl={canonical}
        onShareResult={handleShare}
        ctaRef={ctaRef}
      />

      <section
        aria-label="Lots"
        className="container mx-auto max-w-[1200px] px-4 py-5 md:py-8"
      >
        {facets ? (
          <HomeFilters
            total={facets.total}
            totalCapped={facets.capped}
            categories={closed ? outcomeOptions : categoryOptions}
            makes={closed ? [] : makeOptions}
            priceRange={closed ? null : facets.priceRange}
            category={closed ? applied.outcome : applied.category}
            make={applied.make}
            price={applied.price}
            onCategory={(key) => {
              if (closed) update({ outcome: key as OutcomeKey | null });
              else update({ category: key });
            }}
            onMake={(key) => {
              update({ make: key });
            }}
            onPrice={(price) => {
              update({ price });
            }}
            searchValue={search}
            onSearchChange={setSearch}
            className="mb-4"
          />
        ) : null}

        {lotsResult && facets ? (
          <>
            <SortControl
              countText={formatLotCount(
                filtersOn ? matched : facets.total,
                !filtersOn && facets.capped
              )}
              value={applied.sort}
              onChange={(sort) => {
                update({ sort });
              }}
              className="mb-4"
            />
            {lots.length > 0 ? (
              <HomeLotGrid
                lots={lots}
                watchedIds={watchedSet}
                onToggleWatch={(lotId) => {
                  void handleToggleWatch(lotId);
                }}
                showCloses={false}
                now={now}
              />
            ) : (
              <div className="py-8">
                <p className="text-muted-foreground">
                  {facets.total === 0
                    ? "No lots in this sale yet."
                    : "No lots match these filters."}
                </p>
                {facets.total > 0 && filtersOn ? (
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>
            )}
            {remaining > 0 ? (
              <Button
                variant="outline"
                className="mt-6 w-full md:w-auto"
                onClick={() => {
                  setPages({ key: filterKey, count: pageCount + 1 });
                }}
              >
                Show {Math.min(PAGE_SIZE, remaining)} more · {shown} of{" "}
                {matched}
              </Button>
            ) : null}
            {closed ? (
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link to="/">
                  See current auctions
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </>
        ) : (
          <p role="status" className="py-8 text-muted-foreground">
            Loading lots
          </p>
        )}
      </section>

      {!closed && waHref ? (
        <SellerStrip
          href={waHref}
          commissionPct={settings.sellerCosts.commissionPct}
          className="container mx-auto max-w-[1200px] border"
        />
      ) : null}

      {closed ? null : (
        <BeforeYouBid
          className="mt-8"
          transportHref="/support"
          finance={settings.financeContact}
          depositEnabled={settings.deposit.enabled}
        />
      )}

      {showSticky ? <div className="h-[68px] md:hidden" /> : null}
      <FeesRulesSheet
        open={feesOpen}
        onOpenChange={setFeesOpen}
        premiumPct={premiumPct}
        deposit={settings.deposit}
        exampleBid={example?.bid}
      />
      <AddToHomeScreenSheet
        open={sheet === "home-screen"}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
      />
      <PermissionPrompt
        open={sheet === "permission"}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
        onAllow={handleAllow}
        description="So we can tell you when this sale opens."
      />
      {closed ? null : (
        <StickyBar
          hidden={!showSticky}
          title={stickyTitle}
          sub={stickySub}
          urgent={!upcoming && auction.effectiveEndTime - now < URGENT_MS}
          whatsappHref={waHref}
          cta={isAuthenticated ? "My bids" : "Register to bid"}
          onCta={() => {
            void navigate(isAuthenticated ? "/dashboard/bids" : "/login");
          }}
          label={isAuthenticated ? "My bids" : "Register to bid"}
        />
      )}
    </>
  );
}
