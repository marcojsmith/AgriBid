import type { Ref } from "react";
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import type { BidEligibility } from "convex/lib/bidEligibility";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { softCloseRule } from "@/lib/auctionRules";
import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
import { groupDigits as group, type ViewerBidState } from "@/lib/lotPage";
import type { SellerVatKind } from "@/lib/vat";
import { cn } from "@/lib/utils";

import { Banner } from "./Banner";
import { Countdown } from "./Countdown";
import { CostBox } from "./CostBox";
import { DepositLines } from "./DepositLines";
import { Money } from "./Money";
import type { ReserveState } from "./ReservePill";

/** Whether the viewer may bid, and what stops them; `loading` until known. */
export type PanelEligibility = BidEligibility | { kind: "loading" };

/**
 * The banner and button for a registration state that stops a signed-in buyer
 * from bidding (owner-approved copy).
 *
 * @param eligibility - The state, never `ok` or `loading`
 * @param hrefs - Where the buttons go
 * @param hrefs.registrationHref - The registration flow
 * @param hrefs.statusHref - The registration status page
 * @returns The banner kind and text, and the button
 */
function registrationPrompt(
  eligibility: Exclude<BidEligibility, { kind: "ok" }>,
  hrefs: { registrationHref: string; statusHref: string }
): {
  kind: "warn" | "info";
  text: string;
  label: string;
  href: string;
  variant: "default" | "outline";
} {
  switch (eligibility.kind) {
    case "incomplete":
      return {
        kind: "warn",
        text: `Finish registration to bid. Step ${String(eligibility.step)} of ${String(eligibility.totalSteps)}.`,
        label: "Continue registration",
        href: hrefs.registrationHref,
        variant: "default",
      };
    case "under_review":
      return {
        kind: "info",
        text: "Documents under review. You can bid once approved.",
        label: "See my registration",
        href: hrefs.statusHref,
        variant: "outline",
      };
    case "needs_replacing":
      return {
        kind: "warn",
        text: "One document needs replacing.",
        label: "Replace document",
        href: hrefs.statusHref,
        variant: "default",
      };
    case "deposit_due":
      return {
        kind: "warn",
        text: `Pay your ${formatRand(eligibility.amount)} deposit to bid.`,
        label: "Pay deposit",
        href: hrefs.statusHref,
        variant: "default",
      };
  }
}

interface BidPanelProps {
  /** Guest, registered, leading or outbid. */
  viewer: ViewerBidState;
  /** The opening price (no bids) or the current bid. */
  price: number;
  bidCount: number;
  watchers: number;
  /** When bidding closes (ms), including any extension. */
  closesAt: number;
  /** The lot is in its soft-close extension. */
  extended: boolean;
  /** Server-computed reserve state, for the explainer in the leading and outbid states. */
  reserve: ReserveState;
  /** The cost box: worked at the minimum bid, for this lot's seller. */
  cost: {
    bid: number;
    seller: SellerVatKind;
    premiumPct: number;
    fixedFees?: number;
    vatRatePct: number;
    onFeesClick: () => void;
  };
  /** Deposit lines for guests; left out when no deposit is charged. */
  deposit?: { amount: number; refundDays: number };
  /** The smallest bid the server accepts. */
  minimum: number;
  /** The three quick amounts. */
  quickAmounts: readonly [number, number, number];
  /** What the bid field holds (digits). */
  amount: number;
  onAmountChange: (amount: number) => void;
  /** Opens the confirm sheet for the field's amount. */
  onBid: () => void;
  /** Where "Register to bid" goes (the sign-in page, back to this lot). */
  registerHref: string;
  /** Where "Continue registration" goes (`/register?callbackUrl=…`). */
  registrationHref: string;
  /** Where "See my registration", "Replace document" and "Pay deposit" go. */
  registrationStatusHref: string;
  /** Where a signed-in viewer stands on registration. */
  eligibility: PanelEligibility;
  /** Ref for the main call to action; the sticky bar shows once it scrolls away. */
  ctaRef?: Ref<HTMLDivElement>;
  /** Id so the sticky bar can scroll here. */
  id?: string;
  className?: string;
}

/**
 * The banner and button of a registration state.
 *
 * @param props - Component props
 * @param props.prompt - The copy and link from {@link registrationPrompt}
 * @returns The banner and the button
 */
function RegistrationPrompt({
  prompt,
}: {
  prompt: ReturnType<typeof registrationPrompt>;
}) {
  return (
    <>
      <Banner kind={prompt.kind}>{prompt.text}</Banner>
      <Button asChild variant={prompt.variant} className="w-full">
        <Link to={prompt.href}>{prompt.label}</Link>
      </Button>
    </>
  );
}

/**
 * The reserve explainer for the leading and outbid states.
 *
 * @param reserve - The reserve state
 * @returns The sentence, or null when there is nothing to explain
 */
function reserveNote(reserve: ReserveState): string | null {
  if (reserve === "not-met") {
    return "Reserve not met. If bidding ends below it, the seller decides whether to accept the top bid.";
  }
  if (reserve === "met") return "Reserve met.";
  return null;
}

/**
 * The bid panel for an open lot (design `lot-r4`): the state banner, the
 * price with bids and watchers, the closing time with the soft-close rule,
 * the worked total, then the action for the viewer. A guest gets "Register to
 * bid" and the deposit lines. A registered viewer gets "Your bid" prefilled
 * with the minimum, three quick amounts and "Bid R x"; the leading viewer
 * gets the same with an outline "Raise my bid". Only the next minimum is
 * shown, never an increment table, and there is no maximum (proxy) bid field.
 * A bid always goes through the confirm sheet (`onBid` opens it).
 *
 * @param props - Component props
 * @param props.viewer - The viewer's state
 * @param props.price - Opening price or current bid
 * @param props.bidCount - Number of bids
 * @param props.watchers - Number of watchers
 * @param props.closesAt - Closing time (ms)
 * @param props.extended - Whether the soft close has extended the lot
 * @param props.reserve - Reserve state
 * @param props.cost - Worked-total inputs
 * @param props.deposit - Deposit lines for guests
 * @param props.minimum - Minimum bid
 * @param props.quickAmounts - The three quick amounts
 * @param props.amount - The bid field's value
 * @param props.onAmountChange - Called when the field or a quick amount changes it
 * @param props.onBid - Opens the confirm sheet
 * @param props.registerHref - Sign-in link for guests
 * @param props.registrationHref - Registration flow link
 * @param props.registrationStatusHref - Registration status link
 * @param props.eligibility - Whether the viewer may bid, or what stops them
 * @param props.ctaRef - Ref for the main call to action
 * @param props.id - Element id
 * @param props.className - Extra classes merged onto the root element
 * @returns The panel
 */
export function BidPanel({
  viewer,
  price,
  bidCount,
  watchers,
  closesAt,
  extended,
  reserve,
  cost,
  deposit,
  minimum,
  quickAmounts,
  amount,
  onAmountChange,
  onBid,
  registerHref,
  registrationHref,
  registrationStatusHref,
  eligibility,
  ctaRef,
  id,
  className,
}: BidPanelProps) {
  const hasBids = bidCount > 0;
  const belowMinimum = amount < minimum;
  const note =
    viewer === "leading" || viewer === "outbid" ? reserveNote(reserve) : null;
  const counts = [
    hasBids
      ? `${String(bidCount)} ${bidCount === 1 ? "bid" : "bids"}`
      : "No bids yet",
    `${String(watchers)} watching`,
  ];

  return (
    <section
      id={id}
      data-slot="bid-panel"
      data-viewer={viewer}
      aria-label="Bidding"
      className={cn(
        "flex flex-col gap-3 lg:rounded-md lg:border lg:border-border lg:bg-card lg:p-5",
        className
      )}
    >
      {extended ? (
        <Banner kind="urgent">
          Extended: a bid in the last 2 minutes added 2 minutes
        </Banner>
      ) : null}
      {viewer === "leading" ? (
        <Banner kind="ok">You&apos;re leading</Banner>
      ) : null}
      {viewer === "outbid" ? (
        <Banner kind="warn">You&apos;ve been outbid</Banner>
      ) : null}
      {note ? (
        <p className="text-[15px] text-muted-foreground">{note}</p>
      ) : null}

      <div>
        <Money
          amount={price}
          label={hasBids ? "Current bid" : "Opening bid"}
          display
        />
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          {counts[0]} · <Eye aria-hidden="true" className="size-4" />
          {counts[1]}
        </p>
      </div>

      <div>
        <p className="text-[15px]">
          <b className="font-bold">
            Closes in <Countdown endTime={closesAt} className="font-bold" />
          </b>{" "}
          <span className="text-muted-foreground">
            · {formatSastDate(closesAt)}
          </span>
        </p>
        {extended ? null : (
          <p className="text-sm text-muted-foreground">{softCloseRule()}.</p>
        )}
      </div>

      <CostBox
        bid={cost.bid}
        seller={cost.seller}
        premiumPct={cost.premiumPct}
        fixedFees={cost.fixedFees}
        vatRatePct={cost.vatRatePct}
        onFeesClick={cost.onFeesClick}
      />

      <div ref={ctaRef} className="flex flex-col gap-3">
        {viewer === "guest" ? (
          <>
            <Button asChild className="w-full">
              <Link to={registerHref}>Register to bid</Link>
            </Button>
            {deposit ? (
              <DepositLines
                amount={deposit.amount}
                refundDays={deposit.refundDays}
              />
            ) : null}
          </>
        ) : eligibility.kind === "loading" ? (
          <div aria-hidden="true" className="flex flex-col gap-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : eligibility.kind !== "ok" ? (
          <RegistrationPrompt
            prompt={registrationPrompt(eligibility, {
              registrationHref,
              statusHref: registrationStatusHref,
            })}
          />
        ) : (
          <>
            <div>
              <label
                htmlFor="lot-bid-amount"
                className="text-sm text-muted-foreground"
              >
                Your bid
              </label>
              <Input
                id="lot-bid-amount"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={belowMinimum}
                aria-describedby={belowMinimum ? "lot-bid-help" : undefined}
                value={`R ${group(amount)}`}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "");
                  onAmountChange(
                    digits === "" ? 0 : Number(digits.slice(0, 12))
                  );
                }}
                className="num mt-1 h-12 text-lg font-bold"
              />
              {belowMinimum ? (
                <p
                  id="lot-bid-help"
                  role="alert"
                  className="mt-1 text-sm text-warn-fg"
                >
                  The minimum bid is {formatRand(minimum)}.
                </p>
              ) : null}
            </div>
            <div
              className="grid grid-cols-3 gap-2"
              role="group"
              aria-label="Quick bid amounts"
            >
              {quickAmounts.map((quick) => (
                <Button
                  key={quick}
                  type="button"
                  variant="outline"
                  aria-pressed={amount === quick}
                  className={cn(
                    "num h-11 px-1 text-sm font-semibold",
                    amount === quick && "border-primary bg-primary-soft"
                  )}
                  onClick={() => {
                    onAmountChange(quick);
                  }}
                >
                  {formatRand(quick)}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              className="w-full"
              variant={viewer === "leading" ? "outline" : "default"}
              disabled={belowMinimum}
              onClick={onBid}
            >
              {viewer === "leading"
                ? "Raise my bid"
                : `Bid ${formatRand(amount)}`}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
