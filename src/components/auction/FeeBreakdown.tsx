import React from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Receipt, Users, Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVatRate } from "@/hooks/useVatRate";
import { formatCurrency, formatRand } from "@/lib/currency";
import {
  calculateBuyerTotal,
  vatBaseForSeller,
  type SellerVatKind,
} from "@/lib/vat";

/**
 * Component displaying fee breakdown for auction participants.
 * @param lotId - The ID of the lot
 * @param isWinner - Whether the user won the lot
 * @param isSeller - Whether the user is the seller
 * @param hammerPrice - The winning bid; enables the VAT and estimated total rows for the buyer
 * @param sellerVatKind - The lot's seller VAT kind; a private seller charges VAT on the premium only
 */
interface FeeBreakdownProps {
  lotId: Id<"lots"> | undefined;
  isWinner: boolean;
  isSeller: boolean;
  hammerPrice?: number;
  sellerVatKind?: SellerVatKind;
}

/**
 * Displays the fee breakdown for a sold lot to the winner or seller.
 *
 * When `hammerPrice` is given the buyer section also shows VAT (on the hammer
 * price plus buyer fees, or on the fees alone for a private seller, at the admin-set rate) and an estimated total.
 * @param props - The component props.
 * @param props.lotId - The ID of the lot.
 * @param props.isWinner - Whether the user is the lot winner.
 * @param props.isSeller - Whether the user is the lot seller.
 * @param props.hammerPrice - The winning bid, when known.
 * @param props.sellerVatKind - The seller's VAT kind (default: VAT on bid plus fees).
 * @returns The FeeBreakdown React component or null if no fees.
 */
export function FeeBreakdown({
  lotId,
  isWinner,
  isSeller,
  hammerPrice,
  sellerVatKind = "vat",
}: FeeBreakdownProps): React.JSX.Element | null {
  const vatRatePct = useVatRate();
  const fees = useQuery(
    api.admin.getLotFeesForUser,
    lotId ? { lotId } : "skip"
  );

  if (!fees) {
    return null;
  }

  // A winner always gets the VAT estimate once the price and rate are known,
  // even when no buyer fee applies (premium 0).
  const showBuyerFees =
    isWinner &&
    (fees.buyerFees.length > 0 ||
      (hammerPrice !== undefined && vatRatePct !== undefined));
  const showSellerFees = isSeller && fees.sellerFees.length > 0;

  if (!showBuyerFees && !showSellerFees) {
    return null;
  }

  const totalBuyerFees = fees.buyerFees.reduce(
    (sum, f) => sum + f.calculatedAmount,
    0
  );
  const totalSellerFees = fees.sellerFees.reduce(
    (sum, f) => sum + f.calculatedAmount,
    0
  );

  // Round each fee first and sum the rounded values, so the rows shown with an
  // estimate always add up to "Total fees".
  const roundedBuyerFees = fees.buyerFees.map((f) =>
    Math.round(f.calculatedAmount)
  );
  const estimate =
    isWinner && hammerPrice !== undefined && vatRatePct !== undefined
      ? calculateBuyerTotal({
          bid: hammerPrice,
          premium: roundedBuyerFees.reduce((sum, n) => sum + n, 0),
          vatRatePct,
          vatBase: vatBaseForSeller(sellerVatKind),
        })
      : null;

  return (
    <Card className="border border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          Fee Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showBuyerFees && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <Users className="h-3 w-3" />
              Your Fees (as Buyer)
            </div>
            <div className="space-y-1">
              {/* With an estimate every row is whole rand so the lines add up. */}
              {estimate && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hammer price</span>
                  <span className="font-medium">
                    {formatRand(estimate.bid)}
                  </span>
                </div>
              )}
              {fees.buyerFees.map((fee) => (
                <div key={fee.feeName} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{fee.feeName}</span>
                  <span className="font-medium">
                    {estimate
                      ? formatRand(Math.round(fee.calculatedAmount))
                      : formatCurrency(fee.calculatedAmount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t pt-1">
                <span>{estimate ? "Total fees" : "Total"}</span>
                <span>
                  {estimate
                    ? formatRand(estimate.premium)
                    : formatCurrency(totalBuyerFees)}
                </span>
              </div>
              {estimate && vatRatePct !== undefined && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      VAT ({vatRatePct}% on{" "}
                      {sellerVatKind === "private" ? "fees" : "bid + fees"})
                    </span>
                    <span className="font-medium">
                      {formatRand(estimate.vat)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-1">
                    <span>Estimated total incl. VAT</span>
                    <span>{formatRand(estimate.total)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showSellerFees && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <Building2 className="h-3 w-3" />
              Your Fees (as Seller)
            </div>
            <div className="space-y-1">
              {fees.sellerFees.map((fee) => (
                <div key={fee.feeName} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{fee.feeName}</span>
                  <span className="font-medium">
                    {formatCurrency(fee.calculatedAmount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t pt-1">
                <span>Total</span>
                <span>{formatCurrency(totalSellerFees)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
