import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface BidConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  auctionId?: string;
  auctionTitle?: string;
  proposedBidAmount?: number;
  currentPrice?: number;
}

export function BidConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  auctionTitle = "Selected Auction",
  proposedBidAmount = 0,
  currentPrice = 0,
}: BidConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Confirm Your Bid
          </DialogTitle>
          <DialogDescription>
            Please review the bid details before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            You are about to place a bid through the AI assistant. Please
            confirm that you want to proceed with this bid.
          </p>
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium">Auction:</span>
              <span className="text-sm">{auctionTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Your Bid:</span>
              <span className="text-sm font-bold">
                £{proposedBidAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm font-medium">Current Price:</span>
              <span className="text-sm">£{currentPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} className="gap-2">
            <XCircle className="h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={onConfirm} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Confirm Bid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
