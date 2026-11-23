import type { ReactNode } from "react";

import { BottomSheet } from "@/components/ds/BottomSheet";
import { formatRand } from "@/lib/currency";
import { DEFAULT_VAT_RATE_PCT } from "@/lib/vat";

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
 * deposit, payment, collection, closing and reserve, each in one line. Every
 * figure comes from the platform settings.
 *
 * @param props - Component props
 * @param props.open - Whether the sheet is open
 * @param props.onOpenChange - Called when the sheet asks to open or close
 * @param props.premiumPct - Buyer's premium percentage
 * @param props.vatRatePct - VAT percentage
 * @param props.deposit - Deposit settings
 * @returns The sheet
 */
export function FeesRulesSheet({
  open,
  onOpenChange,
  premiumPct,
  vatRatePct = DEFAULT_VAT_RATE_PCT,
  deposit,
}: FeesRulesSheetProps) {
  const rows: [string, ReactNode][] = [
    ["Buyer's premium", `${pct(premiumPct)}% of the bid, plus VAT`],
    [
      "VAT",
      `${pct(vatRatePct)}% on the premium. On the bid too when the seller is VAT registered. Each lot shows which.`,
    ],
  ];
  if (deposit?.enabled) {
    rows.push([
      "Registration deposit",
      `${formatRand(deposit.amount)}, refunded within ${String(deposit.refundDays)} working days if you don't buy`,
    ]);
  }
  rows.push(
    [
      "Payment",
      `EFT within 48 hours.${deposit?.enabled ? " Your deposit counts towards payment" : ""}`,
    ],
    ["Collection", "Within 7 days of payment"],
    ["Closing", "Bids in the last 2 minutes add 2 minutes"],
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
