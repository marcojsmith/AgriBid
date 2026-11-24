import type { Ref } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, ShieldCheck } from "lucide-react";

import { CostBox } from "@/components/ds/CostBox";
import { DepositLines } from "@/components/ds/DepositLines";
import { IconList, IconRow } from "@/components/ds/IconRow";
import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { SaleList, type SaleListItem } from "@/components/home/SaleList";
import type { DepositSettings } from "@/components/ds/FeesRulesSheet";
import { Button } from "@/components/ui/button";
import { softCloseRule } from "@/lib/auctionRules";
import { formatRand } from "@/lib/currency";
import { formatClosesIn } from "@/lib/countdown";
import { formatSastDate } from "@/lib/dates";
import { formatLotCount } from "@/lib/homeSales";
import { cn } from "@/lib/utils";

/** The sale the hero describes. */
export interface HeroSale {
  _id: string;
  title: string;
  startTime: number;
  endTime: number;
  /** End including soft-close extensions. */
  effectiveEndTime: number;
  lotCount: number;
  bucket: "live" | "upcoming";
}

/** The most-engaged lot, shown as the hero photo. */
export interface FeaturedLot {
  _id: string;
  /** "2016 John Deere 8370RT". */
  title: string;
  town: string;
  /** Opening or current bid in rand. */
  price: number;
  hasBids: boolean;
  imageUrl?: string;
}

/** The lot the cost box works through. */
export interface ExampleLot {
  title: string;
  bid: number;
}

interface HomeHeroProps {
  /** The sale to describe, or null in the multi-sale state (the band then lists the sales). */
  sale: HeroSale | null;
  /** The live and upcoming sales, soonest first; shown as compact rows when there are two or more. */
  sales?: readonly SaleListItem[];
  featured: FeaturedLot | null;
  example: ExampleLot | null;
  premiumPct: number;
  vatRatePct?: number;
  deposit: DepositSettings;
  signedIn: boolean;
  now: number;
  /** Ref for the primary call to action; the sticky bar shows once it scrolls out. */
  ctaRef?: Ref<HTMLDivElement>;
  onFeesClick: () => void;
  /** Where "View all N lots" goes. */
  lotsHref: string;
  /** Lots across the open sales, for "View all N lots". */
  totalLots: number;
  /** True when the count is a lower bound (a sale was capped). */
  totalCapped?: boolean;
  className?: string;
}

/**
 * The Home hero (home-r8). A dark green band with the status, the sale title,
 * close or opening time (or, with two or more sales, "Live auctions" and one
 * compact row per sale), the cost box, the call to action and, for guests, the
 * deposit and trust lines. The most-engaged lot is the photo with its caption:
 * on desktop it covers the right 56% of the band with a short green-to-clear
 * fade on its left edge only, so all text sits on solid green; on phones it
 * sits behind the top of the band and the green fades down into it.
 *
 * The call to action is state-aware: "Register to bid" for guests, "My bids"
 * when signed in (who also don't need the deposit and trust lines).
 *
 * @param props - Component props
 * @param props.sale - The sale to describe; null in the multi-sale state
 * @param props.sales - The live and upcoming sales listed in the multi-sale state
 * @param props.featured - The featured lot, or null to show no photo
 * @param props.example - The lot the cost box works through, or null to hide it
 * @param props.premiumPct - Buyer's premium percentage
 * @param props.vatRatePct - VAT percentage
 * @param props.deposit - Deposit settings
 * @param props.signedIn - Whether the visitor is signed in
 * @param props.now - Current time (ms)
 * @param props.ctaRef - Ref for the primary call to action
 * @param props.onFeesClick - Opens the Fees & rules sheet
 * @param props.lotsHref - Where "View all N lots" goes
 * @param props.totalLots - Lots across the open sales
 * @param props.totalCapped - Whether the count is a lower bound
 * @param props.className - Extra classes merged onto the root element
 * @returns The hero
 */
export function HomeHero({
  sale,
  sales = [],
  featured,
  example,
  premiumPct,
  vatRatePct,
  deposit,
  signedIn,
  now,
  ctaRef,
  onFeesClick,
  lotsHref,
  totalLots,
  totalCapped = false,
  className,
}: HomeHeroProps) {
  const live = sale?.bucket === "live";
  const lots = formatLotCount(totalLots, totalCapped);
  const when = sale ? (live ? sale.effectiveEndTime : sale.startTime) : 0;
  const multi = sale === null && sales.length >= 2;
  const liveCount = sales.filter((s) => s.bucket === "live").length;
  const upcoming = sales.filter((s) => s.bucket === "upcoming");
  const summary = [
    `${String(liveCount)} live`,
    upcoming.length === 1
      ? `1 opens ${formatSastDate(upcoming[0].startTime)}`
      : upcoming.length > 1
        ? `${String(upcoming.length)} upcoming`
        : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section
      data-slot="home-hero"
      aria-labelledby={sale || multi ? "home-hero-title" : undefined}
      aria-label={sale || multi ? undefined : "Register to bid"}
      className={cn(
        "relative bg-hero text-hero-foreground lg:flex lg:min-h-[480px] lg:items-center",
        className
      )}
    >
      {featured ? (
        <Link
          to={`/auction/${featured._id}`}
          className="relative block h-[240px] overflow-hidden sm:h-[300px] lg:absolute lg:inset-y-0 lg:right-0 lg:left-[44%] lg:h-auto"
        >
          <PhotoFrame
            src={featured.imageUrl}
            alt=""
            fill
            eager
            className="rounded-none"
          />
          {/* Desktop caption scrim. A separate layer BELOW the left-edge fade so
              the fade covers the photo's full height; a scrim on the caption
              itself would sit above the fade and leave a hard edge. */}
          <span
            aria-hidden="true"
            data-slot="hero-scrim"
            className="absolute inset-x-0 bottom-0 hidden h-32 bg-linear-to-t from-black/75 to-transparent lg:block"
          />
          <span
            aria-hidden="true"
            data-slot="hero-fade"
            className="absolute inset-y-0 left-0 hidden w-[27%] bg-linear-to-r from-hero to-transparent lg:block"
          />
          <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-hero via-hero/70 to-transparent px-4 pt-16 pb-3.5 text-white lg:bg-none lg:px-8 lg:pb-5">
            <span className="min-w-0">
              <span className="block font-display text-lg leading-tight font-semibold lg:text-xl">
                {featured.title}
              </span>
              <span className="num block text-sm">
                {featured.town ? `${featured.town} · ` : ""}
                {featured.hasBids ? "Current bid" : "Opening bid"}{" "}
                {formatRand(featured.price)}
              </span>
            </span>
            <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
          </span>
        </Link>
      ) : null}

      <div className="relative z-10 px-4 pt-5 pb-6 lg:w-[44%] lg:py-10 lg:pr-8 lg:pl-[max(2rem,calc((100vw-1200px)/2+1rem))]">
        {multi ? (
          <>
            <h1
              id="home-hero-title"
              className="font-display text-[26px] leading-[1.15] font-semibold md:text-4xl"
            >
              <span className="md:hidden">Auctions</span>
              <span className="hidden md:inline">Live auctions</span>
            </h1>
            <p className="num mt-1 text-sm text-hero-muted">{summary}</p>
            <SaleList sales={sales} now={now} className="mt-3" />
          </>
        ) : null}
        {sale ? (
          <>
            <div className="flex items-center gap-2.5">
              <StatusBadge
                variant="solid"
                status={
                  live
                    ? { kind: "live" }
                    : { kind: "opens", startTime: sale.startTime }
                }
              />
              {live ? (
                <span className="num text-[15px] font-semibold">
                  {formatClosesIn(sale.effectiveEndTime - now)}
                </span>
              ) : null}
            </div>
            <h1
              id="home-hero-title"
              className="mt-3 font-display text-[26px] leading-[1.15] font-semibold text-balance md:text-4xl"
            >
              {sale.title}
            </h1>
            <p className="num mt-2 text-base">
              {formatSastDate(when)} · {lots}
            </p>
            {live ? (
              <p className="mt-0.5 text-sm text-hero-muted">
                {softCloseRule()}.
              </p>
            ) : null}
          </>
        ) : null}

        {example ? (
          <CostBox
            onDark
            seller="any"
            bid={example.bid}
            example={example.title}
            premiumPct={premiumPct}
            vatRatePct={vatRatePct}
            onFeesClick={onFeesClick}
            className="mt-4 max-w-full md:max-w-md"
          />
        ) : null}

        <div ref={ctaRef} className="mt-4 flex flex-wrap gap-3">
          <Button
            asChild
            className="flex-1 bg-hero-foreground text-hero hover:bg-hero-foreground/90 sm:flex-none"
          >
            {signedIn ? (
              <Link to="/dashboard/bids">My bids</Link>
            ) : (
              <Link to="/login">Register to bid</Link>
            )}
          </Button>
          {multi ? null : (
            <Button
              asChild
              variant="outline"
              className="flex-1 border-hero-muted/60 bg-transparent text-hero-foreground hover:bg-white/10 hover:text-hero-foreground sm:flex-none"
            >
              <Link to={lotsHref}>View all {lots}</Link>
            </Button>
          )}
        </div>

        {signedIn ? null : (
          <>
            {deposit.enabled ? (
              <DepositLines
                onDark
                amount={deposit.amount}
                refundDays={deposit.refundDays}
                className="mt-3"
              />
            ) : null}
            <IconList className="mt-4 border-t border-hero-muted/30 pt-4">
              <IconRow onDark icon={ShieldCheck}>
                Seller ID checked (FICA)
              </IconRow>
              <IconRow onDark icon={Camera}>
                Inspection photos on every lot
              </IconRow>
            </IconList>
          </>
        )}
      </div>
    </section>
  );
}
