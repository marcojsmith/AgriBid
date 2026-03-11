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
import { LoadingIndicator } from "@/components/LoadingIndicator";

export interface BulkActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
  selectedCount: number;
  targetStatus: string | null;
}

/**
 * Dialog component for confirming bulk status updates on multiple auctions.
 *
 * Displays a confirmation message showing the number of auctions that will be updated
 * and the target status, with Cancel and Confirm actions.
 *
 * @param props - Component props
 * @param props.isOpen - Controls whether the dialog is visible
 * @param props.onClose - Called when the dialog is dismissed
 * @param props.onConfirm - Called when the user confirms the bulk update
 * @param props.isProcessing - When true, disables actions and shows loading indicator on button
 * @param props.selectedCount - Number of auctions that will be updated
 * @param props.targetStatus - The status to apply to the selected auctions
 * @returns A bulk action confirmation dialog component
 */
export function BulkActionDialog({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  selectedCount,
  targetStatus,
}: BulkActionDialogProps) {
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
