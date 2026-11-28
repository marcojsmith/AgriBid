/**
 * The Account page's wording rules: pure mappings from the data the page reads
 * to the text of each row, the action banner and the deposit page. Keeping them
 * here keeps the components thin and lets every rule be unit-tested.
 */

import type { BidEligibility } from "convex/lib/bidEligibility";

import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";
import {
  buildStatusRows,
  registerPath,
  type Registration,
} from "@/lib/registrationCopy";
import { paymentBanner, type PaymentSummaryFacts } from "@/lib/myBids";

/** Where the register pages send the buyer back to. */
export const ACCOUNT_PATH = "/account";

/** Listing counts from `getMyListingsStats` (the fields the page reads). */
export interface ListingStats {
  all: number;
  active: number;
  sold: number;
}

/**
 * Whether the buyer has ever listed anything. A buyer who has not sees
 * "Sell equipment" as one row below Bidding.
 *
 * @param stats - Listing counts, or undefined while loading
 * @returns True when at least one listing exists
 */
export function hasListings(stats: ListingStats | undefined): boolean {
  return stats !== undefined && stats.all > 0;
}

/**
 * The My listings row value: "2 live · 1 sold". Live means active.
 *
 * @param stats - Listing counts
 * @returns The text, "No live lots" when both counts are zero
 */
export function listingsSummary(stats: ListingStats): string {
  const parts = [
    stats.active > 0 ? `${String(stats.active)} live` : null,
    stats.sold > 0 ? `${String(stats.sold)} sold` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "No live lots";
}

/**
 * The Seller details row value: "Naidoo Landbou · VAT registered".
 *
 * @param profile - The seller facts on the profile
 * @param profile.companyName - Business name
 * @param profile.vatRegistered - VAT status
 * @returns The text, or "Add your seller details" when nothing is set
 */
export function sellerDetailsSummary(profile: {
  companyName?: string;
  vatRegistered?: boolean;
}): string {
  const company = profile.companyName?.trim();
  const parts = [
    company !== undefined && company !== "" ? company : null,
    profile.vatRegistered === true ? "VAT registered" : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : "Add your seller details";
}

/**
 * The Registration row value.
 *
 * @param eligibility - Where the buyer stands
 * @returns For example "You can bid" or "One document needs replacing"
 */
export function registrationSummary(eligibility: BidEligibility): string {
  switch (eligibility.kind) {
    case "ok":
      return "You can bid";
    case "incomplete":
      return `Step ${String(eligibility.step)} of ${String(eligibility.totalSteps)}`;
    case "under_review":
      return "Under review";
    case "needs_replacing":
      return eligibility.count === 1
        ? "One document needs replacing"
        : `${String(eligibility.count)} documents need replacing`;
    case "deposit_due":
      return `Pay your ${formatRand(eligibility.amount)} deposit`;
    case "refund_requested":
      return "Deposit refund requested";
  }
}

/** The lot that used the deposit as a credit. */
export interface CreditedLot {
  title: string;
  lotNumber?: number;
}

/**
 * "Lot 1 JCB 3CX", or just the title when the lot has no number.
 *
 * @param lot - The lot
 * @returns The label
 */
export function creditedLotLabel(lot: CreditedLot): string {
  return lot.lotNumber === undefined
    ? lot.title
    : `Lot ${String(lot.lotNumber)} ${lot.title}`;
}

/** What the Deposit page and row show. */
export type DepositView =
  | { kind: "off" }
  | { kind: "not_started"; amount: number }
  | { kind: "awaiting"; amount: number }
  | { kind: "checking"; amount: number }
  | {
      kind: "received";
      amount: number;
      receivedAt?: number;
      credited?: CreditedLot;
    }
  | { kind: "refund_requested"; amount: number; requestedAt?: number }
  | { kind: "refunded"; amount: number; refundedAt?: number };

/**
 * Reads the deposit state out of the registration.
 *
 * @param registration - The buyer's registration
 * @param credited - The lot the deposit was credited to, when known
 * @returns The state, "off" when the platform takes no deposit and none exists
 */
export function depositView(
  registration: Registration,
  credited?: CreditedLot
): DepositView {
  const { deposit, depositSettings } = registration;
  if (!deposit) {
    return depositSettings.enabled
      ? { kind: "not_started", amount: depositSettings.amount }
      : { kind: "off" };
  }
  switch (deposit.status) {
    case "awaiting":
      return { kind: "awaiting", amount: deposit.amount };
    case "paid_claimed":
      return { kind: "checking", amount: deposit.amount };
    case "received":
      return {
        kind: "received",
        amount: deposit.amount,
        receivedAt: deposit.receivedAt,
        credited,
      };
    case "refund_requested":
      return {
        kind: "refund_requested",
        amount: deposit.amount,
        requestedAt: deposit.refundRequestedAt,
      };
    case "refunded":
      return {
        kind: "refunded",
        amount: deposit.amount,
        refundedAt: deposit.refundedAt,
      };
  }
}

/**
 * The Deposit row value on Account.
 *
 * @param view - The deposit state
 * @returns For example "R 5 000 · Credited to Lot 1 JCB 3CX", or null when no deposit applies
 */
export function depositSummary(view: DepositView): string | null {
  switch (view.kind) {
    case "off":
      return null;
    case "not_started":
      return `${formatRand(view.amount)} · Not paid yet`;
    case "awaiting":
      return `${formatRand(view.amount)} · Not paid yet`;
    case "checking":
      return `${formatRand(view.amount)} · We're checking your payment`;
    case "received":
      return view.credited
        ? `${formatRand(view.amount)} · Credited to ${creditedLotLabel(view.credited)}`
        : `${formatRand(view.amount)} received`;
    case "refund_requested":
      return `${formatRand(view.amount)} · Refund requested`;
    case "refunded":
      return `${formatRand(view.amount)} · Refunded`;
  }
}

/**
 * Whether the "Ask for refund" button shows: a received deposit with something
 * left to refund and no unpaid won lot. (The server also refuses while the
 * buyer leads an open lot and says so.)
 *
 * @param view - The deposit state
 * @param refundableAmount - Rand a refund would return
 * @param unpaidCount - Won lots not yet paid for
 * @returns True when the button shows
 */
export function canAskRefund(
  view: DepositView,
  refundableAmount: number,
  unpaidCount: number
): boolean {
  return view.kind === "received" && refundableAmount > 0 && unpaidCount === 0;
}

/** The banner at the top of Account and its action. */
export interface AccountBannerModel {
  kind: "warn" | "urgent";
  text: string;
  label: string;
  to: string;
}

/**
 * The one thing that needs doing, if any: a won lot to pay first (it has a
 * deadline), then a document to replace, unfinished registration or a deposit
 * to pay. Nothing is shown when all is well.
 *
 * @param input - What the page knows
 * @param input.summary - The payment summary
 * @param input.registration - The buyer's registration
 * @param input.now - Current time (ms)
 * @returns The banner, or null
 */
export function accountBanner(input: {
  summary: PaymentSummaryFacts | undefined;
  registration: Registration | null | undefined;
  now: number;
}): AccountBannerModel | null {
  const { summary, registration, now } = input;
  if (summary && summary.awaitingCount > 0) {
    const pay = paymentBanner([], now, summary);
    if (pay?.kind === "warn") {
      return {
        kind: "urgent",
        text: pay.text,
        label: "Pay now",
        to: "/dashboard/bids?tab=won",
      };
    }
  }
  if (!registration) return null;
  const { eligibility } = registration;
  switch (eligibility.kind) {
    case "needs_replacing":
      return {
        kind: "warn",
        text: registrationSummary(eligibility),
        label: "Replace document",
        to: replacePath(registration) ?? registerPath("status"),
      };
    case "incomplete":
      return {
        kind: "warn",
        text: `Finish registration to bid. Step ${String(eligibility.step)} of ${String(eligibility.totalSteps)}.`,
        label: "Continue registration",
        to: registerPath("", { callbackUrl: ACCOUNT_PATH }),
      };
    case "deposit_due":
      return {
        kind: "warn",
        text: `Pay your ${formatRand(eligibility.amount)} deposit to bid.`,
        label: "Pay deposit",
        to: registerPath("deposit", { callbackUrl: ACCOUNT_PATH }),
      };
    default:
      return null;
  }
}

/**
 * The route that replaces the first rejected document (the same route the
 * registration status page uses), returning to Account afterwards.
 *
 * @param registration - The buyer's registration
 * @returns The path, or null when no document is rejected
 */
export function replacePath(registration: Registration): string | null {
  const row = buildStatusRows(registration).find(
    (r) => r.action && r.action.command === undefined && r.action.replace
  );
  const step = row?.action && "step" in row.action ? row.action.step : null;
  return step
    ? registerPath(step, { callbackUrl: ACCOUNT_PATH, replace: true })
    : null;
}

/**
 * Whether the Details rows can open the register details step. Only before
 * the documents are sent: after that the step redirects to the status page and
 * the server refuses edits, so the rows are read-only.
 *
 * @param eligibility - Where the buyer stands
 * @returns True while registration is unfinished
 */
export function detailsEditable(
  eligibility: BidEligibility | undefined
): boolean {
  return eligibility?.kind === "incomplete";
}

/**
 * The ID number line: "Ends in 084".
 *
 * @param last3 - Last three characters of the ID or passport number
 * @returns The text, or "Not added" when there is none
 */
export function idEndsIn(last3: string | undefined): string {
  return last3 ? `Ends in ${last3}` : "Not added";
}

/**
 * "Refunded within 3 working days".
 *
 * @param days - Working days
 * @returns The sentence
 */
export function refundWithin(days: number): string {
  return `Refunded within ${String(days)} working ${days === 1 ? "day" : "days"}.`;
}

/**
 * "Received Sun 22 Nov, 10:40" style line for the deposit page.
 *
 * @param verb - "received", "refunded"
 * @param amount - Rand
 * @param at - Time (ms), when known
 * @returns "R 5 000 received Sun 22 Nov, 10:40"
 */
export function depositDated(
  verb: "received" | "refunded",
  amount: number,
  at: number | undefined
): string {
  return at === undefined
    ? `${formatRand(amount)} ${verb}`
    : `${formatRand(amount)} ${verb} ${formatSastDate(at)}`;
}

/** The three push switches (unset means on), plus the retired settings that still gate watched-lot alerts. */
export interface AlertPrefs {
  notificationsWatchedLots?: boolean;
  notificationsBidOutbid?: boolean;
  notificationsWatchlistEnding?: "disabled" | "1h" | "3h" | "24h";
  notificationsLotsWon?: boolean;
  notificationsSalesOpening?: boolean;
}

/**
 * Whether watched-lot alerts really reach the user. The new switch turns both
 * alerts off, but the retired outbid and ending settings (no screen edits them
 * any more) still gate each alert on the server, so a user who once turned one
 * off must see the switch off, and turning it on must clear them.
 *
 * @param prefs - The saved preferences, or null
 * @returns True when outbid and closing-soon alerts are both allowed
 */
export function watchedAlertsOn(prefs: AlertPrefs | null | undefined): boolean {
  const ending = prefs?.notificationsWatchlistEnding;
  return (
    prefs?.notificationsWatchedLots !== false &&
    prefs?.notificationsBidOutbid !== false &&
    (ending === undefined || ending === "1h")
  );
}

/** The fields that make {@link watchedAlertsOn} true. */
export const WATCHED_ALERTS_ON_PATCH = {
  notificationsWatchedLots: true,
  notificationsBidOutbid: true,
  notificationsWatchlistEnding: "1h",
} as const;

/**
 * How many of the three alert switches are on. No saved preferences means all
 * three.
 *
 * @param prefs - The saved preferences, or null
 * @returns 0 to 3
 */
export function alertsOnCount(prefs: AlertPrefs | null | undefined): number {
  return [
    watchedAlertsOn(prefs),
    prefs?.notificationsLotsWon !== false,
    prefs?.notificationsSalesOpening !== false,
  ].filter(Boolean).length;
}

/**
 * The "On this phone" row value: "On · 3 alerts", "Off", "Blocked" and so on.
 *
 * @param state - The push state of this browser
 * @param prefs - The saved preferences, or null
 * @returns The text
 */
export function notificationsSummary(
  state: "loading" | "on" | "off" | "blocked" | "install" | "unsupported",
  prefs: AlertPrefs | null | undefined
): string {
  switch (state) {
    case "loading":
      return "Checking…";
    case "on": {
      const count = alertsOnCount(prefs);
      return `On · ${String(count)} ${count === 1 ? "alert" : "alerts"}`;
    }
    case "off":
      return "Off";
    case "blocked":
      return "Blocked in your browser";
    case "install":
      return "Add AgriBid to your Home Screen";
    case "unsupported":
      return "Not available on this browser";
  }
}
