import type { Ref } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, ShieldCheck } from "lucide-react";

import { CostBox } from "@/components/ds/CostBox";
import { DepositLines } from "@/components/ds/DepositLines";
import { IconList, IconRow } from "@/components/ds/IconRow";
import { PhotoFrame } from "@/components/ds/PhotoFrame";
import { StatusBadge } from "@/components/ds/StatusBadge";
import type { DepositSettings } from "@/components/ds/FeesRulesSheet";
import { Button } from "@/components/ui/button";
import { formatRand } from "@/lib/currency";
import { formatClosesIn } from "@/lib/countdown";
import { formatSastDate } from "@/lib/dates";
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
  /** The sale to describe, or null in the multi-sale state (the band then has no title). */
  sale: HeroSale | null;
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
  className?: string;
}

/**
 * The Home hero for one sale (r5): the most-engaged lot as a photo with its
 * caption, then a dark green band with the status, the sale title, close or
 * opening time, the cost box, the call to action and, for guests, the deposit
 * and trust lines. On desktop the text sits left of the photo.
 *
 * The call to action is state-aware: "Register to bid" for guests, "My bids"
 * when signed in (who also don't need the deposit and trust lines).
 *
 * @param props - Component props
 * @param props.sale - The sale to describe; null in the multi-sale state, where the band keeps only the cost box, call to action and trust lines
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
 * @param props.className - Extra classes merged onto the root element
 * @returns The hero
 */
export function HomeHero({
  sale,
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
  className,
}: HomeHeroProps) {
  const live = sale?.bucket === "live";
  const lots = `${String(totalLots)} ${totalLots === 1 ? "lot" : "lots"}`;
  const when = sale ? (live ? sale.effectiveEndTime : sale.startTime) : 0;
  return (
    <section
      data-slot="home-hero"
      aria-labelledby={sale ? "home-hero-title" : undefined}
      aria-label={sale ? undefined : "Register to bid"}
      className={cn(
        "bg-hero text-hero-foreground lg:grid lg:grid-cols-[1fr_1fr]",
        className
      )}
    >
      {sale && featured ? (
        <Link
          to={`/auction/${featured._id}`}
          className="relative block h-[220px] overflow-hidden sm:h-[300px] lg:order-2 lg:h-auto lg:min-h-[480px]"
        >
          <PhotoFrame
            src={featured.imageUrl}
            alt=""
            fill
            eager
            className="rounded-none"
          />
          <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent px-4 pt-12 pb-3.5 text-white lg:px-8 lg:pb-5">
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

      <div className="px-4 pt-5 pb-6 lg:order-1 lg:flex lg:flex-col lg:justify-center lg:px-8 lg:py-10 lg:pl-[max(2rem,calc((100vw-1200px)/2))]">
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
                Bids in the last 2 minutes add 2 minutes.
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
            className="mt-4 max-w-md"
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
          <Button
            asChild
            variant="outline"
            className="flex-1 border-hero-muted/60 bg-transparent text-hero-foreground hover:bg-white/10 hover:text-hero-foreground sm:flex-none"
          >
            <Link to={lotsHref}>View all {lots}</Link>
          </Button>
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
