// app/src/pages/Home.tsx
import { useMemo, useState } from "react";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { BeforeYouBid } from "@/components/ds/BeforeYouBid";
import { FeesRulesSheet } from "@/components/ds/FeesRulesSheet";
import { SellerStrip } from "@/components/ds/SellerStrip";
import { StickyBar } from "@/components/ds/StickyBar";
import { TransportQuoteSheet } from "@/components/ds/TransportQuoteSheet";
import { showToast } from "@/components/ds/showToast";
import { HomeFilters, type PriceFilter } from "@/components/home/HomeFilters";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeLotGrid } from "@/components/home/HomeLotGrid";
import { SaleLotGroup } from "@/components/home/SaleLotGroup";
import { LotBrowser } from "@/components/LotBrowser";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/useBranding";
import { useNow } from "@/hooks/useNow";
import { useScrolledPast } from "@/hooks/useScrolledPast";
import { useTransportQuote } from "@/hooks/useTransportQuote";
import { lotTitle, lotTitleWithYear } from "@/lib/lotTitle";
import { WATCHING_MESSAGE } from "@/lib/auctionRules";
import { formatClosesIn } from "@/lib/countdown";
import { URGENT_MS } from "@/lib/auction-badges";
import { formatSastDate } from "@/lib/dates";
import { formatLotCount, pickHomeSales, whatsappLink } from "@/lib/homeSales";
import {
  buildTitle,
  buildCanonical,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
} from "@/lib/seo";
import { PAGINATION_INITIAL_ITEMS } from "@/lib/constants";

/** The grid size on Home. */
const GRID_SIZE = 6;

/** The most sales the Home grid and filters read (matches the backend cap). */
const MAX_OPEN_SALES = 4;

/** The resolved image URLs of a lot. */
interface LotImages {
  front?: string;
  engine?: string;
  cabin?: string;
  rear?: string;
  additional: string[];
}

/**
 * Picks the lead photo of a lot: front, cabin, engine, rear, then the first
 * extra.
 *
 * @param images - The lot's resolved image URLs
 * @returns The URL, or undefined when there is none
 */
function leadPhoto(images: LotImages): string | undefined {
  return [
    images.front,
    images.cabin,
    images.engine,
    images.rear,
    images.additional[0],
  ].find((url): url is string => typeof url === "string" && url !== "");
}

/**
 * Render the AgriBid home page (design `home-r5`): the sale hero (or the
 * multi-sale list when two or more sales are live or upcoming), the most
 * engaged lot, search and filters, the lot grid, the free-valuation strip, the
 * "Before you bid" block and, on phones once the hero call to action scrolls
 * out, a sticky bar. Every price, date and count comes from data. When a
 * search query (`?q=`) is present the global lot-results view is shown instead.
 *
 * @returns The JSX element for the Home page
 */
export default function Home() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Ticks every 5 s so the seconds in the last 10 minutes stay current.
  const now = useNow(5000);
  const { isAuthenticated } = useConvexAuth();
  const branding = useBranding();

  const rawQuery = searchParams.get("q");
  const searchQuery =
    rawQuery === null || rawQuery === "" ? undefined : rawQuery;
  const searching = searchQuery !== undefined;

  const [filters, setFilters] = useState<{
    saleKey: string;
    category: string | null;
    make: string | null;
    price: PriceFilter;
  }>({ saleKey: "", category: null, make: null, price: {} });
  const [feesOpen, setFeesOpen] = useState(false);
  const transport = useTransportQuote();
  const [ctaRef, ctaGone] = useScrolledPast();

  const active = usePaginatedQuery(
    api.auctions.getPublishedAuctions,
    searching ? "skip" : { status: "active" },
    { initialNumItems: PAGINATION_INITIAL_ITEMS }
  );
  const sales = useMemo(
    () => pickHomeSales(active.results, now),
    [active.results, now]
  );
  const { hero, open, mode } = sales;
  // The filtered grid belongs to the single-sale state only: with two or more
  // sales the lots are grouped per sale and have no filters (home-r8).
  const gridSaleIds = useMemo(
    () => (mode === "single" && hero ? [hero._id] : []),
    [mode, hero]
  );
  const liveSales = useMemo(
    () =>
      open.filter((sale) => sale.bucket === "live").slice(0, MAX_OPEN_SALES),
    [open]
  );

  // Filters belong to the set of sales they were picked in: when a sale opens
  // or closes the chips change, so a stale pick is dropped instead of hiding
  // lots behind a chip that no longer exists.
  const saleKey = gridSaleIds.join(",");
  const current =
    filters.saleKey === saleKey
      ? filters
      : { saleKey, category: null, make: null, price: {} as PriceFilter };
  const { category, make, price } = current;

  const settings = useQuery(
    api.admin.platformSettings.getPlatformSettings,
    searching ? "skip" : {}
  );
  const featuredRows = useQuery(
    api.engagement.getMostEngagedLots,
    hero && mode === "single" ? { auctionId: hero._id, limit: 1 } : "skip"
  );
  const featuredAcross = useQuery(
    api.engagement.getMostEngagedLotAcrossSales,
    mode === "multi" && liveSales.length > 0
      ? { auctionIds: liveSales.map((sale) => sale._id) }
      : "skip"
  );
  const home = useQuery(
    api.auctions.getHomeLots,
    gridSaleIds.length > 0
      ? {
          auctionIds: gridSaleIds,
          categoryId: (category ?? undefined) as
            Id<"equipmentCategories"> | undefined,
          make: make ?? undefined,
          minPrice: price.min,
          maxPrice: price.max,
          limit: GRID_SIZE,
        }
      : "skip"
  );

  // The chips' data is its own query so picking a chip re-runs only the grid.
  const facets = useQuery(
    api.auctions.getHomeFacets,
    gridSaleIds.length > 0 ? { auctionIds: gridSaleIds } : "skip"
  );

  const watchedIds = useQuery(
    api.watchlist.getWatchedLotIds,
    isAuthenticated ? {} : "skip"
  );
  const watchedSet = useMemo(
    () => new Set<string>(watchedIds ?? []),
    [watchedIds]
  );
  const toggleWatchlist = useMutation(api.watchlist.toggleWatchlist);

  const handleToggleWatch = async (lotId: string) => {
    if (!isAuthenticated) {
      toast.info("Please sign in to watch a lot");
      void navigate(`/login?callbackUrl=${encodeURIComponent("/")}`);
      return;
    }
    try {
      const watching = await toggleWatchlist({
        lotId: lotId as Id<"lots">,
      });
      if (watching) showToast(WATCHING_MESSAGE);
      else toast.success("Removed from watchlist");
    } catch {
      toast.error("Failed to update watchlist");
    }
  };

  const pageTitle = buildTitle("Agricultural Equipment Auctions");
  const canonical = buildCanonical("/");

  const businessInfo = branding?.businessInfo;
  const waHref = whatsappLink(businessInfo?.whatsapp);
  const premiumPct = settings?.buyerPremiumPct ?? 0;

  const featuredRow = mode === "multi" ? featuredAcross : featuredRows?.[0];
  const featured = featuredRow
    ? {
        _id: featuredRow.lot._id,
        title: lotTitleWithYear(featuredRow.lot),
        town: featuredRow.lot.location,
        price:
          featuredRow.bids > 0
            ? featuredRow.lot.currentPrice
            : featuredRow.lot.startingPrice,
        hasBids: featuredRow.bids > 0,
        imageUrl: leadPhoto(featuredRow.lot.images),
      }
    : null;

  // A cached result cannot track time, so lots that have closed since the
  // query ran are dropped here.
  const gridLots = (home?.lots ?? []).filter(
    (lot) => lot.effectiveEndTime > now
  );
  const firstLot = gridLots[0];
  const example = featured
    ? { title: featured.title, bid: featured.price }
    : firstLot
      ? {
          title: lotTitle(firstLot),
          bid: firstLot.currentPrice,
        }
      : null;

  const lotsHref =
    mode === "single" && hero ? `/auctions/${hero._id}` : "/auctions";
  // The sale's own lot count is exact (a per-sale counter); the facets only
  // describe the open lots that were read.
  const totalLots = hero?.lotCount ?? facets?.total ?? 0;
  const totalCapped = hero ? hero.lotCountCapped : (facets?.capped ?? false);

  const categories = (facets?.categories ?? []).map((c) => ({
    key: c.categoryId,
    label: c.name,
    count: c.count,
  }));
  const makes = (facets?.makes ?? []).map((m) => ({
    key: m.make,
    label: m.make,
    count: m.count,
  }));

  const showSticky = ctaGone && hero !== null;
  const stickyRemaining =
    hero?.bucket === "live" ? hero.effectiveEndTime - now : Infinity;
  const stickyTitle =
    hero?.bucket === "live"
      ? formatClosesIn(hero.effectiveEndTime - now)
      : hero
        ? `Opens ${formatSastDate(hero.startTime)}`
        : "";
  const loading = active.status === "LoadingFirstPage";

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={DEFAULT_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={DEFAULT_OG_IMAGE} />
        <meta name="robots" content="index, follow" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={DEFAULT_DESCRIPTION} />
        <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
        <meta name="twitter:url" content={canonical} />
      </Helmet>
      {searching ? (
        <div className="container mx-auto px-4 py-4 md:px-8 md:py-8">
          <LotBrowser />
        </div>
      ) : (
        <>
          {settings && (mode === "single" || mode === "multi") ? (
            <HomeHero
              sales={
                mode === "multi"
                  ? open.map((sale) => ({
                      _id: sale._id,
                      title: sale.title,
                      startTime: sale.startTime,
                      effectiveEndTime: sale.effectiveEndTime,
                      lotCount: sale.lotCount,
                      lotCountCapped: sale.lotCountCapped,
                      bucket: sale.bucket,
                    }))
                  : undefined
              }
              sale={
                mode === "single" && hero
                  ? {
                      _id: hero._id,
                      title: hero.title,
                      startTime: hero.startTime,
                      endTime: hero.endTime,
                      effectiveEndTime: hero.effectiveEndTime,
                      lotCount: hero.lotCount,
                      bucket: hero.bucket,
                    }
                  : null
              }
              featured={featured}
              example={example}
              premiumPct={premiumPct}
              deposit={settings.deposit}
              signedIn={isAuthenticated}
              now={now}
              ctaRef={ctaRef}
              lotsHref={lotsHref}
              totalLots={totalLots}
              totalCapped={totalCapped}
              onFeesClick={() => {
                setFeesOpen(true);
              }}
            />
          ) : null}

          {loading ? (
            <p
              role="status"
              className="px-4 py-10 text-center text-muted-foreground"
            >
              Loading auctions
            </p>
          ) : null}

          {mode === "none" && !loading ? (
            <section className="container mx-auto max-w-[1200px] px-4 py-10">
              <h1 className="font-display text-[26px] font-semibold">
                No auctions are open right now
              </h1>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/auctions">See past auctions</Link>
              </Button>
            </section>
          ) : null}

          {mode === "multi" ? (
            <section
              aria-label="Lots by auction"
              className="container mx-auto max-w-[1200px] px-4 py-5 md:py-8"
            >
              {liveSales.map((sale) => (
                <SaleLotGroup
                  key={sale._id}
                  sale={sale}
                  now={now}
                  watchedIds={watchedSet}
                  onToggleWatch={(id) => {
                    void handleToggleWatch(id);
                  }}
                />
              ))}
            </section>
          ) : null}

          {gridSaleIds.length > 0 && home && facets ? (
            <section
              aria-label="Lots"
              className="container mx-auto max-w-[1200px] px-4 py-5 md:py-8"
            >
              <HomeFilters
                total={totalLots}
                totalCapped={totalCapped}
                categories={categories}
                makes={makes}
                priceRange={facets.priceRange}
                category={category}
                make={make}
                price={price}
                onCategory={(key) => {
                  setFilters({ ...current, category: key });
                }}
                onMake={(key) => {
                  setFilters({ ...current, make: key });
                }}
                onPrice={(next) => {
                  setFilters({ ...current, price: next });
                }}
                onSearch={(query) => {
                  void navigate(`/?q=${encodeURIComponent(query)}`);
                }}
                className="mb-5"
              />
              {gridLots.length > 0 ? (
                <HomeLotGrid
                  lots={gridLots}
                  watchedIds={watchedSet}
                  onToggleWatch={(id) => {
                    void handleToggleWatch(id);
                  }}
                  showCloses={mode === "multi"}
                  now={now}
                />
              ) : (
                <p className="py-8 text-muted-foreground">
                  No lots match these filters.
                </p>
              )}
              <Button
                asChild
                variant="outline"
                className="mt-6 w-full md:w-auto"
              >
                <Link to={lotsHref}>
                  View all {formatLotCount(totalLots, totalCapped)}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </section>
          ) : null}

          {settings && waHref ? (
            <SellerStrip
              href={waHref}
              commissionPct={settings.sellerCosts.commissionPct}
              className="container mx-auto max-w-[1200px] border"
            />
          ) : null}

          {settings ? (
            <BeforeYouBid
              className="mt-8"
              onTransportClick={() => {
                transport.setOpen(true);
              }}
              finance={settings.financeContact}
              depositEnabled={settings.deposit.enabled}
            />
          ) : null}

          {showSticky && settings ? (
            <div className="h-[68px] md:hidden" />
          ) : null}
          {settings && hero ? (
            <FeesRulesSheet
              open={feesOpen}
              onOpenChange={setFeesOpen}
              premiumPct={premiumPct}
              deposit={settings.deposit}
            />
          ) : null}
          <TransportQuoteSheet {...transport.sheetProps} />
          {hero ? (
            <StickyBar
              hidden={!showSticky}
              title={stickyTitle}
              sub={mode === "multi" ? hero.title : undefined}
              urgent={stickyRemaining < URGENT_MS}
              whatsappHref={waHref}
              cta={isAuthenticated ? "My bids" : "Register to bid"}
              onCta={() => {
                void navigate(isAuthenticated ? "/dashboard/bids" : "/login");
              }}
              label={isAuthenticated ? "My bids" : "Register to bid"}
            />
          ) : null}
        </>
      )}
    </>
  );
}
