// app/src/components/BidConfirmation.tsx
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
import { Gavel } from "lucide-react";

interface BidConfirmationProps {
  isOpen: boolean;
  amount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BidConfirmation = ({ isOpen, amount, onConfirm, onCancel }: BidConfirmationProps) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-md rounded-2xl border-2">
        <AlertDialogHeader className="flex flex-col items-center text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Gavel className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Confirm your bid</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium">
              You are about to place a bid for
            </AlertDialogDescription>
          </div>
          <div className="bg-primary/5 border-2 border-primary/20 w-full py-6 rounded-2xl">
            <span className="text-4xl font-black text-primary tracking-tight">
              R{amount.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest px-4">
            By confirming, you agree to purchase this equipment at this price if you are the winning bidder.
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:space-x-0 mt-4">
          <AlertDialogCancel onClick={onCancel} className="h-12 font-bold rounded-xl border-2">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            className="h-12 font-black rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          >
            Confirm Bid
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
