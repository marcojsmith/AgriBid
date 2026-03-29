import React from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Receipt, Users, Building2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";

/**
 * Component displaying fee breakdown for auction participants.
 * @param auctionId - The ID of the auction
 * @param userId - The ID of the current user
 * @param isWinner - Whether the user won the auction
 * @param isSeller - Whether the user is the seller
 */
interface FeeBreakdownProps {
  auctionId: Id<"auctions"> | undefined;
  userId: string;
  isWinner: boolean;
  isSeller: boolean;
}

/**
 * Displays the fee breakdown for a sold auction to the winner or seller.
 * @param props - The component props.
 * @param props.auctionId - The ID of the auction.
 * @param props.userId - The ID of the user viewing the fees.
 * @param props.isWinner - Whether the user is the auction winner.
 * @param props.isSeller - Whether the user is the auction seller.
 * @returns The FeeBreakdown React component or null if no fees.
 */
export function FeeBreakdown({
  auctionId,
  userId,
  isWinner,
  isSeller,
}: FeeBreakdownProps): React.JSX.Element | null {
  const fees = useQuery(
    api.admin.getAuctionFeesForUser,
    auctionId ? { auctionId, userId } : "skip"
  );

  if (!fees || (fees.buyerFees.length === 0 && fees.sellerFees.length === 0)) {
    return null;
  }

  const showBuyerFees = isWinner && fees.buyerFees.length > 0;
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

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
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
              {fees.buyerFees.map((fee, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{fee.feeName}</span>
                  <span className="font-medium">
                    {formatCurrency(fee.calculatedAmount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold border-t pt-1">
                <span>Total</span>
                <span>{formatCurrency(totalBuyerFees)}</span>
              </div>
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
              {fees.sellerFees.map((fee, index) => (
                <div key={index} className="flex justify-between text-sm">
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
