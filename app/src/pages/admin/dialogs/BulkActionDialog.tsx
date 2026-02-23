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
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";

/**
 * Dialog component for confirming bulk status updates on multiple auctions.
 *
 * Displays a confirmation message showing the number of auctions that will be updated
 * and the target status, with Cancel and Confirm actions.
 *
 * @param isOpen - Controls whether the dialog is visible
 * @param onClose - Called when the dialog is dismissed
 * @param onConfirm - Called when the user confirms the bulk update
 * @param isProcessing - When true, disables actions and shows loading indicator on button
 * @param selectedCount - Number of auctions that will be updated
 * @param targetStatus - The status to apply to the selected auctions (may be null if not specified)
 */
export function BulkActionDialog({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  selectedCount,
  targetStatus,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
  selectedCount: number;
  targetStatus: string | null;
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-2xl border-2">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-black uppercase tracking-tight">
            Perform Bulk Status Update?
          </AlertDialogTitle>
          <AlertDialogDescription className="font-medium text-sm">
            You are about to update{" "}
            <span className="font-bold text-primary">
              {selectedCount} auctions
            </span>{" "}
            to status{" "}
            <span className="font-bold text-primary uppercase">
              {(targetStatus ?? "unspecified").toUpperCase()}
            </span>
            . This action is auditable and affects marketplace visibility.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-2 font-bold uppercase text-[10px]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isProcessing}
            className="rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px]"
          >
            {isProcessing ? (
              <LoadingIndicator size="sm" className="mr-2" />
            ) : null}
            Confirm Update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
