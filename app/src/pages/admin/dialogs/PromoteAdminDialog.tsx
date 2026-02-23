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
 * Renders a confirmation dialog to promote a user to an administrative role.
 *
 * Shows the target user's name or email and warns that the promotion grants full access
 * to the Command Center and system settings. Provides Cancel and Promote actions; the
 * Promote action is disabled and displays a loading indicator while `isProcessing` is true.
 * Closing the dialog invokes `onClose`.
 *
 * @param isOpen - Whether the dialog is visible
 * @param onClose - Called when the dialog is dismissed
 * @param onConfirm - Called when the Promote action is confirmed
 * @param isProcessing - When true, disables actions and shows a loading indicator
 * @param targetUser - The user to be promoted; used to display the user's name or email (may be `null`)
 * @returns The AlertDialog React element
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
              {targetUser?.name || targetUser?.email || "this user"}
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
