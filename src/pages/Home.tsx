// app/src/pages/Home.tsx
import { useMemo, useRef, useState } from "react";
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
import { showToast } from "@/components/ds/showToast";
import { HomeFilters, type PriceFilter } from "@/components/home/HomeFilters";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeLotGrid } from "@/components/home/HomeLotGrid";
import { SaleList } from "@/components/home/SaleList";
import { LotBrowser } from "@/components/LotBrowser";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/useBranding";
import { useNow } from "@/hooks/useNow";
import { useScrolledPast } from "@/hooks/useScrolledPast";
import { formatClosesIn } from "@/lib/countdown";
import { formatSastDate } from "@/lib/dates";
import { pickHomeSales, whatsappLink } from "@/lib/homeSales";
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

/** Shown when a lot is watched. */
const WATCHING_MESSAGE =
  "Watching. We'll notify you 1 hour before close and if you're outbid.";

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
  const now = useNow();
  const { isAuthenticated } = useConvexAuth();
  const branding = useBranding();

  const rawQuery = searchParams.get("q");
  const searchQuery =
    rawQuery === null || rawQuery === "" ? undefined : rawQuery;
  const searching = searchQuery !== undefined;

  const [category, setCategory] = useState<string | null>(null);
  const [make, setMake] = useState<string | null>(null);
  const [price, setPrice] = useState<PriceFilter>({});
  const [feesOpen, setFeesOpen] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaGone = useScrolledPast(ctaRef);

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
  const gridSaleIds = useMemo(
    () =>
      (mode === "single" && hero ? [hero._id] : open.map((s) => s._id)).slice(
        0,
        MAX_OPEN_SALES
      ),
    [mode, hero, open]
  );

  const settings = useQuery(
    api.admin.platformSettings.getPlatformSettings,
    searching ? "skip" : {}
  );
  const featuredRows = useQuery(
    api.engagement.getMostEngagedLots,
    hero && mode === "single" ? { auctionId: hero._id, limit: 1 } : "skip"
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
  const premiumPct = settings?.buyerPremiumPct ?? 12;

  const featuredRow = featuredRows?.[0];
  const featured = featuredRow
    ? {
        _id: featuredRow.lot._id,
        title: `${String(featuredRow.lot.year)} ${featuredRow.lot.make} ${featuredRow.lot.model}`,
        town: featuredRow.lot.location,
        price:
          featuredRow.bids > 0
            ? featuredRow.lot.currentPrice
            : featuredRow.lot.startingPrice,
        hasBids: featuredRow.bids > 0,
        imageUrl: leadPhoto(featuredRow.lot.images),
      }
    : null;

  const firstLot = home?.lots[0];
  const example = featured
    ? { title: featured.title, bid: featured.price }
    : firstLot
      ? {
          title: `${firstLot.make} ${firstLot.model}`,
          bid: firstLot.currentPrice,
        }
      : null;

  const lotsHref =
    mode === "single" && hero ? `/auctions/${hero._id}` : "/auctions";
  const totalLots = home?.total ?? hero?.lotCount ?? 0;

  const categories = (home?.categories ?? []).map((c) => ({
    key: c.categoryId,
    label: c.name,
    count: c.count,
  }));
  const makes = (home?.makes ?? []).map((m) => ({
    key: m.make,
    label: m.make,
    count: m.count,
  }));

  const showSticky = ctaGone && hero !== null;
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
          {mode === "multi" ? (
            <SaleList
              now={now}
              className="py-1"
              sales={open.map((sale) => ({
                _id: sale._id,
                title: sale.title,
                startTime: sale.startTime,
                effectiveEndTime: sale.effectiveEndTime,
                lotCount: sale.lotCount,
                bucket: sale.bucket,
                imageUrl: sale.leadImageUrls[0],
              }))}
            />
          ) : null}

          {settings && (mode === "single" || mode === "multi") ? (
            <HomeHero
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

          {gridSaleIds.length > 0 && home ? (
            <section
              aria-label="Lots"
              className="container mx-auto max-w-[1200px] px-4 py-5 md:py-8"
            >
              <HomeFilters
                total={home.total}
                categories={categories}
                makes={makes}
                priceRange={home.priceRange}
                category={category}
                make={make}
                price={price}
                onCategory={setCategory}
                onMake={setMake}
                onPrice={setPrice}
                onSearch={(query) => {
                  void navigate(`/?q=${encodeURIComponent(query)}`);
                }}
                className="mb-5"
              />
              {home.lots.length > 0 ? (
                <HomeLotGrid
                  lots={home.lots}
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
                  View all {home.matched} lots
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
              transportHref="/support"
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
          {hero ? (
            <StickyBar
              hidden={!showSticky}
              title={stickyTitle}
              whatsappHref={waHref}
              cta={isAuthenticated ? "My bids" : "Register to bid"}
              onCta={() => {
                void navigate(isAuthenticated ? "/dashboard/bids" : "/login");
              }}
              label="Register to bid"
            />
          ) : null}
        </>
      )}
    </>
  );
}
