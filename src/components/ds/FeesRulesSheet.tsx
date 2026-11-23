import type { ReactNode } from "react";

import { BottomSheet } from "@/components/ds/BottomSheet";
import {
  COLLECTION_WINDOW_DAYS,
  PAYMENT_WINDOW_HOURS,
  softCloseRule,
} from "@/lib/auctionRules";
import { formatRand } from "@/lib/currency";
import {
  DEFAULT_VAT_RATE_PCT,
  calculateBuyerTotal,
  premiumFromRate,
  vatBaseForSeller,
} from "@/lib/vat";

/** The deposit settings, as `getPlatformSettings` returns them. */
export interface DepositSettings {
  enabled: boolean;
  amount: number;
  refundDays: number;
}

interface FeesRulesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Buyer's premium percentage. */
  premiumPct: number;
  /** VAT percentage. */
  vatRatePct?: number;
  /** Deposit settings; the deposit row and sentence are left out when off. */
  deposit?: DepositSettings;
  /** A bid in rand to work through for both seller kinds (the "Example" row). Left out when missing. */
  exampleBid?: number;
}

/**
 * Formats a percentage without a trailing `.0`.
 *
 * @param n - The percentage
 * @returns The text
 */
function pct(n: number): string {
  return String(Number(n.toFixed(2)));
}

/**
 * The "Fees & rules" bottom sheet opened from the cost box: premium, VAT,
 * deposit, payment, collection, closing and reserve, each in one line. The
 * premium, VAT and deposit come from the platform settings; the soft-close
 * minutes come from the backend constant and the payment and collection
 * windows from `lib/auctionRules` (no setting exists for them).
 *
 * @param props - Component props
 * @param props.open - Whether the sheet is open
 * @param props.onOpenChange - Called when the sheet asks to open or close
 * @param props.premiumPct - Buyer's premium percentage
 * @param props.vatRatePct - VAT percentage
 * @param props.deposit - Deposit settings
 * @param props.exampleBid - A bid to work through for a VAT-registered and a private seller
 * @returns The sheet
 */
export function FeesRulesSheet({
  open,
  onOpenChange,
  premiumPct,
  vatRatePct = DEFAULT_VAT_RATE_PCT,
  deposit,
  exampleBid,
}: FeesRulesSheetProps) {
  const totalFor = (seller: "vat" | "private"): string =>
    formatRand(
      calculateBuyerTotal({
        bid: exampleBid ?? 0,
        premium: premiumFromRate(exampleBid ?? 0, premiumPct / 100),
        vatRatePct,
        vatBase: vatBaseForSeller(seller),
      }).total
    );
  const rows: [string, ReactNode][] = [
    ["Buyer's premium", `${pct(premiumPct)}% of the bid, plus VAT`],
    [
      "VAT",
      `${pct(vatRatePct)}% on the premium. Also on the bid when the seller is VAT registered; each lot shows which`,
    ],
  ];
  if (exampleBid !== undefined) {
    rows.push([
      "Example",
      `${formatRand(exampleBid)} bid, VAT-registered seller → pay ${totalFor("vat")}. Private seller → pay ${totalFor("private")}`,
    ]);
  }
  if (deposit?.enabled) {
    rows.push([
      "Registration deposit",
      `${formatRand(deposit.amount)}, refunded within ${String(deposit.refundDays)} working days if you don't buy`,
    ]);
  }
  rows.push(
    [
      "Payment",
      `EFT within ${String(PAYMENT_WINDOW_HOURS)} hours.${deposit?.enabled ? " Your deposit counts towards payment" : ""}`,
    ],
    ["Collection", `Within ${String(COLLECTION_WINDOW_DAYS)} days of payment`],
    ["Closing", softCloseRule()],
    [
      "Reserve",
      "The seller's minimum price. If bidding ends below it, the seller decides whether to accept the top bid",
    ]
  );
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Fees & rules">
      <dl className="divide-y divide-border">
        {rows.map(([term, text]) => (
          <div key={term} className="py-2.5">
            <dt className="text-sm font-semibold">{term}</dt>
            <dd className="text-sm text-muted-foreground">{text}</dd>
          </div>
        ))}
      </dl>
    </BottomSheet>
  );
}
