import type { Ref } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, MapPin, Truck, Wallet } from "lucide-react";

import { CostBox } from "@/components/ds/CostBox";
import { DepositLines } from "@/components/ds/DepositLines";
import type { DepositSettings } from "@/components/ds/FeesRulesSheet";
import { IconList, IconRow } from "@/components/ds/IconRow";
import { ShareButton } from "@/components/ds/ShareButton";
import { StatusBadge } from "@/components/ds/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  COLLECTION_WINDOW_DAYS,
  PAYMENT_WINDOW_HOURS,
  softCloseRule,
} from "@/lib/auctionRules";
import { formatClosesIn, formatRemaining } from "@/lib/countdown";
import { formatSastDate } from "@/lib/dates";
import { closedSummary, type ClosedTotals } from "@/lib/eventPage";
import type { ShareResult } from "@/lib/share";
import { cn } from "@/lib/utils";

/** The sale the header describes. */
export interface EventHeaderSale {
  title: string;
  startTime: number;
  endTime: number;
  /** End including soft-close extensions. */
  effectiveEndTime: number;
  bucket: "live" | "upcoming" | "closed";
}

/** The lot the cost box works through. */
export interface EventExample {
  title: string;
  bid: number;
}

interface EventHeaderProps {
  sale: EventHeaderSale;
  now: number;
  /** The most-engaged lot of this sale, for the cost box. Left out when the sale has no lots. */
  example: EventExample | null;
  premiumPct: number;
  vatRatePct?: number;
  deposit: DepositSettings;
  signedIn: boolean;
  /** Totals for a closed sale's header line. */
  closed?: ClosedTotals | null;
  /** Shown as the Remind me button on an upcoming sale; left out when the feature is off. */
  onRemind?: () => void;
  onFeesClick: () => void;
  /** Absolute link the share button shares. */
  shareUrl: string;
  onShareResult: (result: ShareResult) => void;
  /** Ref for the primary call to action; the sticky bar shows once it scrolls out. */
  ctaRef?: Ref<HTMLDivElement>;
  className?: string;
}

/**
 * The sale header on the dark green band (design `event-r4`): the status and
 * relative time with the absolute date second, the name, the soft-close line,
 * the cost box worked on this sale's most-engaged lot, "View & collect where
 * each lot stands · Fees & rules", then the call to action beside the share
 * button, and the deposit lines for guests. On desktop the facts sit in a
 * second column. A closed sale shows its totals and "See current auctions"
 * instead of the cost box and Register to bid. An upcoming sale adds a Remind
 * me button when the reminders feature is on.
 *
 * @param props - Component props
 * @param props.sale - The sale to describe
 * @param props.now - Current time (ms)
 * @param props.example - The lot the cost box works through, or null to hide it
 * @param props.premiumPct - Buyer's premium percentage
 * @param props.vatRatePct - VAT percentage
 * @param props.deposit - Deposit settings
 * @param props.signedIn - Whether the visitor is signed in
 * @param props.closed - Totals for a closed sale
 * @param props.onRemind - Called by Remind me; the button is hidden without it
 * @param props.onFeesClick - Opens the Fees & rules sheet
 * @param props.shareUrl - Link the share button shares
 * @param props.onShareResult - Called with the share outcome
 * @param props.ctaRef - Ref for the primary call to action
 * @param props.className - Extra classes merged onto the band
 * @returns The header band
 */
export function EventHeader({
  sale,
  now,
  example,
  premiumPct,
  vatRatePct,
  deposit,
  signedIn,
  closed,
  onRemind,
  onFeesClick,
  shareUrl,
  onShareResult,
  ctaRef,
  className,
}: EventHeaderProps) {
  const { bucket } = sale;
  const live = bucket === "live";
  const upcoming = bucket === "upcoming";
  const isClosed = bucket === "closed";
  const ctaClass = "bg-hero-foreground text-hero hover:bg-hero-foreground/90";
  const dateText = formatSastDate(
    upcoming ? sale.startTime : live ? sale.effectiveEndTime : sale.endTime
  );

  return (
    <section
      data-slot="event-header"
      aria-labelledby="event-title"
      className={cn("bg-hero text-hero-foreground", className)}
    >
      <div className="container mx-auto max-w-[1200px] px-4 pt-5 pb-6 lg:grid lg:grid-cols-2 lg:gap-12 lg:py-9">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge
              variant="solid"
              status={
                live
                  ? { kind: "live" }
                  : upcoming
                    ? {
                        kind: "opens",
                        startTime: sale.startTime,
                        relative: formatRemaining(
                          Math.max(sale.startTime - now, 1000)
                        ),
                      }
                    : { kind: "closed" }
              }
            />
            <span className="num text-[15px] font-semibold">
              {live ? formatClosesIn(sale.effectiveEndTime - now) : dateText}
            </span>
          </div>
          <h1
            id="event-title"
            className="mt-3 font-display text-[26px] leading-[1.15] font-semibold text-balance md:text-4xl"
          >
            {sale.title}
          </h1>
          {live ? <p className="num mt-2 text-base">{dateText}</p> : null}
          {upcoming ? (
            <p className="num mt-2 text-base">
              Closes {formatSastDate(sale.endTime)}
            </p>
          ) : null}
          {isClosed && closed ? (
            <p className="num mt-2 text-base">{closedSummary(closed)}</p>
          ) : null}
          {live || upcoming ? (
            <p className="mt-0.5 text-sm text-hero-muted">{softCloseRule()}.</p>
          ) : null}

          {/* Phone: the cost box sits above the actions. */}
          <div className="lg:hidden">
            {!isClosed && example ? (
              <CostBox
                onDark
                seller="any"
                bid={example.bid}
                example={example.title}
                premiumPct={premiumPct}
                vatRatePct={vatRatePct}
                onFeesClick={onFeesClick}
                className="mt-4"
              />
            ) : null}
            {!isClosed ? (
              <p className="mt-3 text-sm text-hero-muted">
                View &amp; collect where each lot stands ·{" "}
                <button
                  type="button"
                  className="text-hero-foreground underline underline-offset-2"
                  onClick={onFeesClick}
                >
                  Fees &amp; rules
                </button>
              </p>
            ) : null}
          </div>

          <div ref={ctaRef} className="mt-4 flex flex-wrap gap-3">
            {isClosed ? (
              <Button asChild className={`flex-1 sm:flex-none ${ctaClass}`}>
                <Link to="/">
                  See current auctions
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                className={`${upcoming && onRemind ? "w-full lg:w-auto" : "flex-1 sm:flex-none"} ${ctaClass}`}
              >
                {signedIn ? (
                  <Link to="/dashboard/bids">My bids</Link>
                ) : (
                  <Link to="/login">Register to bid</Link>
                )}
              </Button>
            )}
            {upcoming && onRemind ? (
              <Button
                variant="outline"
                onClick={onRemind}
                className="flex-1 border-hero-muted/60 bg-transparent text-hero-foreground hover:bg-white/10 hover:text-hero-foreground sm:flex-none"
              >
                <Bell aria-hidden="true" />
                Remind me
              </Button>
            ) : null}
            <ShareButton
              title={sale.title}
              text={`${sale.title} on AgriBid, ${dateText}`}
              url={shareUrl}
              onResult={onShareResult}
              className="border-hero-muted/60 bg-transparent text-hero-foreground"
            />
          </div>

          {!isClosed && !signedIn && deposit.enabled ? (
            <DepositLines
              onDark
              amount={deposit.amount}
              refundDays={deposit.refundDays}
              className="mt-3 lg:hidden"
            />
          ) : null}
        </div>

        {/* Desktop: the facts column. */}
        {!isClosed ? (
          <div className="hidden lg:block">
            {example ? (
              <CostBox
                onDark
                seller="any"
                bid={example.bid}
                example={example.title}
                premiumPct={premiumPct}
                vatRatePct={vatRatePct}
                onFeesClick={onFeesClick}
                className="max-w-md"
              />
            ) : null}
            <IconList className="mt-4">
              <IconRow onDark icon={MapPin}>
                View &amp; collect where each lot stands ·{" "}
                <button
                  type="button"
                  className="text-hero-foreground underline underline-offset-2"
                  onClick={onFeesClick}
                >
                  Fees &amp; rules
                </button>
              </IconRow>
              <IconRow onDark icon={Truck}>
                Collect within {COLLECTION_WINDOW_DAYS} days ·{" "}
                <Link
                  to="/support"
                  className="text-hero-foreground underline underline-offset-2"
                >
                  Request a transport quote
                </Link>
              </IconRow>
              <IconRow onDark icon={Wallet}>
                Pay by EFT within {PAYMENT_WINDOW_HOURS} hours.
              </IconRow>
            </IconList>
            {!signedIn && deposit.enabled ? (
              <DepositLines
                onDark
                amount={deposit.amount}
                refundDays={deposit.refundDays}
                className="mt-4"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
