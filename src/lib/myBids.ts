import type { BidEligibility } from "convex/lib/bidEligibility";

import { formatRand } from "@/lib/currency";
import type { LotCardState } from "@/components/ds/LotCard";
import { formatSastDate } from "@/lib/dates";
import { groupDigits } from "@/lib/lotPage";

/** The four tabs of My bids, in display order. */
export const MY_BIDS_TABS = ["bidding", "won", "lost", "watching"] as const;

/** One of the My bids tabs. */
export type MyBidsTab = (typeof MY_BIDS_TABS)[number];

/**
 * Reads `?tab=` from the URL.
 *
 * @param raw - The raw query value
 * @returns The tab, or null when missing or not one of the four
 */
export function parseTab(raw: string | null): MyBidsTab | null {
  return MY_BIDS_TABS.find((tab) => tab === raw) ?? null;
}

/**
 * The tab to open when the URL names none: Bidding, unless the buyer has
 * nothing to bid on and a won lot waiting for payment, then Won.
 *
 * @param input - Counts and whether a won lot is awaiting payment
 * @param input.biddingCount - Lots in the Bidding tab
 * @param input.awaitingPayment - A won lot has not been paid
 * @returns The default tab
 */
export function defaultTab(input: {
  biddingCount: number;
  awaitingPayment: boolean;
}): MyBidsTab {
  return input.biddingCount === 0 && input.awaitingPayment ? "won" : "bidding";
}

/** The facts of a Bidding row the confirm sheet and the badge need. */
export interface BiddingRowFacts {
  status: string;
  isWinning: boolean;
  isLeadingConsideration: boolean;
  isExtended?: boolean;
  extendedEndTime?: number;
}

/** What the badge on a Bidding row says. */
export type BidRowBadge = "outbid" | "leading" | "extended" | "consideration";

/**
 * Chooses the badge of a Bidding row. A lot still open and inside its soft
 * close shows "Extended" first (the buyer's own position follows from the
 * button), an `under_consideration` lot always shows its own pill.
 *
 * @param row - The row facts
 * @param now - Current time (ms)
 * @returns The badge
 */
export function bidRowBadge(row: BiddingRowFacts, now: number): BidRowBadge {
  if (row.status === "under_consideration") return "consideration";
  if (
    row.isExtended === true &&
    row.extendedEndTime !== undefined &&
    row.extendedEndTime > now
  ) {
    return "extended";
  }
  return row.isWinning ? "leading" : "outbid";
}

/** What a registration banner shows. */
export interface RegistrationBannerModel {
  kind: "warn" | "info";
  text: string;
  label: string;
  /** Where the button goes. */
  to: "/register" | "/register/status";
  variant: "default" | "outline";
}

/**
 * The banner and action at the top of My bids when the buyer cannot bid yet.
 *
 * @param eligibility - Where the buyer stands
 * @returns The banner, or null when the buyer can bid
 */
export function registrationBanner(
  eligibility: BidEligibility
): RegistrationBannerModel | null {
  switch (eligibility.kind) {
    case "ok":
      return null;
    case "incomplete":
      return {
        kind: "warn",
        text: `Finish registration to bid. Step ${String(eligibility.step)} of ${String(eligibility.totalSteps)}.`,
        label: "Continue registration",
        to: "/register",
        variant: "default",
      };
    case "under_review":
      return {
        kind: "info",
        text: "Documents under review. We check them within 2 business days.",
        label: "See my registration",
        to: "/register/status",
        variant: "outline",
      };
    case "needs_replacing":
      return {
        kind: "warn",
        text:
          eligibility.count === 1
            ? "One document needs replacing."
            : `${String(eligibility.count)} documents need replacing.`,
        label: "Replace document",
        to: "/register/status",
        variant: "default",
      };
    case "deposit_due":
      return {
        kind: "warn",
        text: `Pay your ${formatRand(eligibility.amount)} deposit to bid.`,
        label: "Pay deposit",
        to: "/register/status",
        variant: "default",
      };
    case "refund_requested":
      return {
        kind: "info",
        text: "You asked for your deposit back. Cancel the request to bid.",
        label: "Manage deposit",
        to: "/register/status",
        variant: "outline",
      };
  }
}

/** The payment fields the banner reads. */
export interface PaymentBannerRow {
  status: "awaiting" | "paid_claimed" | "confirmed";
  amountDue: number;
  payBy: number;
  collectBy?: number;
}

/** The payment summary facts the banner can use instead of the loaded rows. */
export interface PaymentSummaryFacts {
  awaitingCount: number;
  claimedCount: number;
  nextPayBy: number | null;
  nextAmountDue: number | null;
}

/** What the banner above the Won tab says. */
export interface PaymentBannerModel {
  kind: "warn" | "info" | "ok";
  text: string;
}

/**
 * The banner above the Won tab: money to pay first, then a payment being
 * checked, then the collection date of a confirmed payment.
 *
 * @param rows - The buyer's payments (newest first)
 * @param now - Current time (ms)
 * @param summary - The payment summary, which counts every payment (not only the loaded ones)
 * @returns The banner, or null when there is nothing to say
 */
export function paymentBanner(
  rows: readonly PaymentBannerRow[],
  now: number,
  summary?: PaymentSummaryFacts
): PaymentBannerModel | null {
  const awaitingRows = rows.filter((row) => row.status === "awaiting");
  const awaitingCount = summary?.awaitingCount ?? awaitingRows.length;
  const earliest =
    summary?.nextPayBy ??
    (awaitingRows.length > 0
      ? Math.min(...awaitingRows.map((row) => row.payBy))
      : null);
  const amount =
    summary?.nextAmountDue ?? awaitingRows.at(0)?.amountDue ?? null;
  if (awaitingCount === 1 && earliest !== null && amount !== null) {
    return {
      kind: "warn",
      text: `Pay ${formatRand(amount)} by ${formatSastDate(earliest)}`,
    };
  }
  if (awaitingCount > 1 && earliest !== null) {
    return {
      kind: "warn",
      text: `${String(awaitingCount)} lots to pay. First due ${formatSastDate(earliest)}`,
    };
  }
  const claimed =
    summary === undefined
      ? rows.some((row) => row.status === "paid_claimed")
      : summary.claimedCount > 0;
  if (claimed) {
    return { kind: "info", text: "We're checking your payment." };
  }
  const collect = rows
    .flatMap((row) =>
      row.status === "confirmed" && row.collectBy !== undefined
        ? [row.collectBy]
        : []
    )
    .filter((at) => at >= now);
  if (collect.length > 0) {
    return {
      kind: "ok",
      text: `Payment received. Collect by ${formatShortDay(Math.min(...collect))}.`,
    };
  }
  return null;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

/**
 * A date with no time, South African time: `Tue 1 Dec`.
 *
 * @param timestamp - Milliseconds since the epoch
 * @returns The weekday, day and month
 */
export function formatShortDay(timestamp: number): string {
  const d = new Date(timestamp + SAST_OFFSET_MS);
  return `${WEEKDAYS[d.getUTCDay()] ?? ""} ${String(d.getUTCDate())} ${MONTHS[d.getUTCMonth()] ?? ""}`;
}

/**
 * Time left in words for a screen reader: `2 hours 30 minutes`, `1 minute 52
 * seconds`. Two largest units, as the visible text.
 *
 * @param remainingMs - Milliseconds left (above 0)
 * @returns The spoken duration
 */
export function spokenRemaining(remainingMs: number): string {
  const total = Math.floor(remainingMs / 1000);
  const units: [number, string][] = [
    [Math.floor(total / 86400), "day"],
    [Math.floor((total % 86400) / 3600), "hour"],
    [Math.floor((total % 3600) / 60), "minute"],
    [total % 60, "second"],
  ];
  const spoken = units
    .filter(([n]) => n > 0)
    .slice(0, 2)
    .map(([n, unit]) => `${String(n)} ${unit}${n === 1 ? "" : "s"}`);
  return spoken.length > 0 ? spoken.join(" ") : "0 seconds";
}

/**
 * The id of a tab button, for `aria-labelledby` on its panel.
 *
 * @param tab - The tab
 * @returns The element id
 */
export function tabId(tab: MyBidsTab): string {
  return `my-bids-tab-${tab}`;
}

/**
 * The id of a tab's panel, for `aria-controls` on its tab.
 *
 * @param tab - The tab
 * @returns The element id
 */
export function panelId(tab: MyBidsTab): string {
  return `my-bids-panel-${tab}`;
}

/** The count under each tab. */
export type TabCounts = Record<MyBidsTab, number>;

/**
 * The count of one tab.
 *
 * @param counts - Counts per tab
 * @param tab - The tab
 * @returns Its count
 */
export function tabCount(counts: TabCounts, tab: MyBidsTab): number {
  switch (tab) {
    case "bidding":
      return counts.bidding;
    case "won":
      return counts.won;
    case "lost":
      return counts.lost;
    case "watching":
      return counts.watching;
  }
}

/**
 * The label of a tab.
 *
 * @param tab - The tab
 * @returns Its label
 */
export function tabLabel(tab: MyBidsTab): string {
  switch (tab) {
    case "bidding":
      return "Bidding";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
    case "watching":
      return "Watching";
  }
}

/**
 * The effective closing time of a row: the soft-close extension, else the
 * sale's end.
 *
 * @param row - End times of the lot
 * @param row.extendedEndTime - The lot's own end, when extended
 * @param row.auctionEndTime - The sale's end
 * @returns Closing time (ms), if known
 */
export function rowClosesAt(row: {
  extendedEndTime?: number;
  auctionEndTime?: number;
}): number | undefined {
  return row.extendedEndTime ?? row.auctionEndTime;
}

/** The lot facts every My bids row shows in its header. */
export interface RowLot {
  _id: string;
  title: string;
  lotNumber?: number;
  year?: number;
  operatingHours?: number;
  location?: string;
  photo?: string;
}

/**
 * The year, hours and town of a lot, joined with " · " and dropping what is
 * unknown (a year or hours of 0 means unknown).
 *
 * @param lot - The lot facts
 * @returns The meta line, empty when nothing is known
 */
export function lotMeta(lot: RowLot): string {
  return [
    lot.year ? String(lot.year) : null,
    lot.operatingHours ? `${groupDigits(lot.operatingHours)} hrs` : null,
    lot.location?.trim() ? lot.location : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

/**
 * The card state and figure for a watched lot. A lot at its opening price shows
 * "Opening bid"; one above it shows "Current bid"; closed lots show their
 * outcome.
 *
 * @param lot - The watched lot
 * @param lot.status - The lot's status
 * @param lot.currentPrice - The current price
 * @param lot.startingPrice - The opening price
 * @returns The state and the price to show
 */
export function watchedCardState(lot: {
  status: string;
  currentPrice: number;
  startingPrice: number;
}): { state: LotCardState; price: number } {
  const price = lot.currentPrice;
  if (lot.status === "sold") return { state: "sold", price };
  if (lot.status === "unsold") return { state: "not-sold", price };
  if (lot.status === "under_consideration") {
    return { state: "under-consideration", price };
  }
  return {
    state: lot.currentPrice > lot.startingPrice ? "current-bid" : "open",
    price,
  };
}
