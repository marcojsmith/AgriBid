// app/src/components/BidConfirmation.tsx
import { useRef } from "react";
import { Gavel } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BidConfirmationProps {
  isOpen: boolean;
  amount: number;
  maxAmount?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Component for a bid confirmation dialog.
 *
 * @param props - Component props.
 * @param props.isOpen - Whether the dialog is open.
 * @param props.amount - The bid amount to confirm.
 * @param props.maxAmount - The maximum bid amount for proxy bidding.
 * @param props.onConfirm - Callback when the bid is confirmed.
 * @param props.onCancel - Callback when the bid is cancelled.
 * @returns The rendered bid confirmation dialog.
 */
export const BidConfirmation = ({
  isOpen,
  amount,
  maxAmount,
  onConfirm,
  onCancel,
}: BidConfirmationProps) => {
  const isConfirmingRef = useRef(false);
  const formattedAmount = new Intl.NumberFormat("en-ZA", {
    maximumFractionDigits: 0,
  }).format(amount);

  const formattedMaxAmount =
    maxAmount != null
      ? new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(
          maxAmount
        )
      : null;

  const handleConfirm = () => {
    isConfirmingRef.current = true;
    onConfirm();
    // Reset after a short delay to allow the dialog to close
    setTimeout(() => {
      isConfirmingRef.current = false;
    }, 100);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isConfirmingRef.current) {
      onCancel();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md rounded-lg border">
        <AlertDialogHeader className="flex flex-col items-center text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Gavel className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <AlertDialogTitle className="text-2xl font-bold">
              Confirm your bid
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium">
              You are about to place a bid for
            </AlertDialogDescription>
          </div>
          <div className="bg-primary/5 border border-primary/20 w-full py-8 rounded-lg flex flex-col items-center shadow-inner">
            <div className="text-center mb-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Current Bid Amount
              </p>
              <span className="text-5xl font-bold text-primary tracking-tight">
                R {formattedAmount}
              </span>
            </div>

            {formattedMaxAmount != null && (
              <div className="w-full flex flex-col items-center mt-2">
                <div className="w-32 border-t border-primary/10 mb-4" />
                <div className="text-center">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Auto-bid Limit (Proxy)
                  </p>
                  <span className="text-2xl font-bold text-primary/60 tracking-tight">
                    R {formattedMaxAmount}
                  </span>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-medium px-4">
            By confirming, you agree to purchase this equipment at this price if
            you are the winning bidder.
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0 mt-4">
          <AlertDialogCancel className="h-12 font-semibold rounded-md border">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="h-12 font-bold rounded-md bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          >
            Confirm Bid
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
