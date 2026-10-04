import { Loader2 } from "lucide-react";

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

/**
 * Props for the {@link DeleteFeeDialog} component.
 */
interface DeleteFeeDialogProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog for deleting a platform fee rule.
 *
 * @param props - Component props.
 * @param props.isOpen - Whether the dialog is open.
 * @param props.isSubmitting - True while the delete mutation is in flight.
 * @param props.onOpenChange - Visibility setter for the dialog.
 * @param props.onConfirm - Handler that deletes the fee.
 * @returns The delete confirmation dialog.
 */
export function DeleteFeeDialog({
  isOpen,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: DeleteFeeDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Fee</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this fee? This action cannot be
            undone. This will not affect fees already calculated on past
            auctions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
