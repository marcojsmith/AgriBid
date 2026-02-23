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
import type { AdminProfile } from "../hooks/useUserManagement";

/**
 * Dialog component for confirming user promotion to administrative role.
 *
 * Displays user details (name or email) and warns about the permissions being granted.
 * Provides Cancel and Promote actions with loading state.
 *
 * @param isOpen - Whether the dialog is visible
 * @param onClose - Callback invoked when the dialog is closed/dismissed
 * @param onConfirm - Callback invoked when the promotion is confirmed
 * @param isProcessing - When true, disables actions and shows loading indicator
 * @param targetUser - The user to be promoted; used to display user's name or email (may be null)
 */
export function PromoteAdminDialog({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  targetUser,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
  targetUser: AdminProfile | null;
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="rounded-2xl border-2">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-black uppercase tracking-tight text-destructive">
            Elevate to Admin Role?
          </AlertDialogTitle>
          <AlertDialogDescription className="font-medium text-sm">
            You are about to promote{" "}
            <span className="font-bold text-primary">
              {targetUser?.name || targetUser?.email}
            </span>{" "}
            to an administrative role. This grants full access to the Command
            Center and system settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl border-2 font-bold uppercase text-[10px]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isProcessing}
            className="rounded-xl bg-destructive text-destructive-foreground font-black uppercase text-[10px]"
          >
            {isProcessing ? (
              <LoadingIndicator size="sm" className="mr-2" />
            ) : null}
            Promote User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
