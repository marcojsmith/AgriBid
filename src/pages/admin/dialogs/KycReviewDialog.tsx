import {
  Fingerprint,
  UserCheck,
  Phone,
  Mail,
  FileText,
  Eye,
  Check,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useProtectedDocument } from "@/hooks/useDocumentPreview";
import { DetailItem } from "@/components/admin/DetailItem";
import type { KycReviewUser } from "@/hooks/admin/useUserManagement";

/**
 * One legacy KYC file, read through the auth-checked document route. Images
 * show as a thumbnail that opens full size; a PDF shows an "Open" link.
 *
 * @param props - Component props
 * @param props.userId - The owner of the file
 * @param props.index - The file's position in the owner's list
 * @returns The document row
 */
function LegacyDocument({ userId, index }: { userId: string; index: number }) {
  const preview = useProtectedDocument({ kind: "legacy", userId, index });
  const label = `View Document ${String(index + 1)}`;
  if (preview.loading) {
    return (
      <p className="flex h-10 items-center gap-2 text-xs text-muted-foreground">
        <LoadingIndicator size="sm" /> Loading document {index + 1}…
      </p>
    );
  }
  if (preview.error !== undefined || preview.href === undefined) {
    return (
      <p role="alert" className="text-xs text-destructive">
        Document {index + 1}: {preview.error ?? "Couldn't load that document."}
      </p>
    );
  }
  return (
    <a
      href={preview.href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center gap-2 rounded-md border p-2 text-xs font-medium hover:bg-muted"
    >
      {preview.src ? (
        <img
          src={preview.src}
          alt={`Document ${String(index + 1)}`}
          className="h-12 w-12 rounded object-cover"
        />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      <Eye className="h-3 w-3" /> {preview.isPdf ? "Open PDF" : label}
    </a>
  );
}

/**
 * Dialog component for reviewing a user's KYC (Know Your Customer) submission.
 *
 * Displays personal details, submitted documents, a rejection-reason textarea,
 * and action buttons to approve or reject the KYC application.
 *
 * @param props - Component props
 * @param props.user - The KYC user to review; when falsy the dialog content is not rendered
 * @param props.isOpen - Controls whether the dialog is open and visible
 * @param props.onClose - Called when the dialog is closed/dismissed by the user
 * @param props.onReview - Called with "approve" or "reject" when the corresponding action is confirmed
 * @param props.isProcessing - Disables actions and shows loading indicators while a review is being processed
 * @param props.rejectionReason - Current text for the rejection reason textarea
 * @param props.setRejectionReason - Updates the rejection reason state
 * @param props.showFullId - When true, displays the full ID/passport number; otherwise masks it
 * @param props.setShowFullId - Toggles the visibility of the full ID/passport number
 * @returns A KYC review dialog component
 */
export function KycReviewDialog({
  user,
  isOpen,
  onClose,
  onReview,
  isProcessing,
  rejectionReason,
  setRejectionReason,
  showFullId,
  setShowFullId,
}: {
  user: KycReviewUser | null;
  isOpen: boolean;
  onClose: () => void;
  onReview: (decision: "approve" | "reject") => void;
  isProcessing: boolean;
  rejectionReason: string;
  setRejectionReason: (reason: string) => void;
  showFullId: boolean;
  setShowFullId: (show: boolean) => void;
}) {
  const isKycReasonEmpty = !rejectionReason.trim();

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            KYC Verification Review
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review the submitted KYC documents and details for user
            verification.
          </DialogDescription>
        </DialogHeader>
        {user && (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Fingerprint className="h-3 w-3" /> Personal Details
                </h3>
                <div className="space-y-3">
                  <DetailItem
                    label="Full Names"
                    value={
                      [user.firstName, user.lastName]
                        .filter(Boolean)
                        .join(" ") || "—"
                    }
                    icon={<UserCheck className="h-4 w-4" />}
                  />
                  <div className="relative group">
                    <DetailItem
                      label="ID/Passport"
                      value={
                        showFullId
                          ? // Intentionally `||` not `??`: an empty string ID also means "not provided"
                            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- see comment above
                            user.idNumber || "Not Provided"
                          : user.idNumber
                            ? `****${user.idNumber.slice(-4)}`
                            : "Not Provided"
                      }
                      icon={<Fingerprint className="h-4 w-4" />}
                    />
                    {user.idNumber && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs font-medium absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {
                          setShowFullId(!showFullId);
                        }}
                      >
                        {showFullId ? "Hide" : "Reveal"}
                      </Button>
                    )}
                  </div>
                  <DetailItem
                    label="Phone"
                    value={
                      // Intentionally `||` not `??`: an empty string phone also means "not provided"
                      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- see comment above
                      user.phoneNumber || "Not Provided"
                    }
                    icon={<Phone className="h-4 w-4" />}
                  />
                  <DetailItem
                    label="Email"
                    value={
                      // Intentionally `||` not `??`: an empty string email also means "not provided"
                      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- see comment above
                      user.kycEmail || "Not Provided"
                    }
                    icon={<Mail className="h-4 w-4" />}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Submitted Documents
                </h3>
                <div className="space-y-2">
                  {Array.from(
                    { length: user.kycDocumentCount ?? 0 },
                    (_, i) => (
                      <LegacyDocument
                        key={`${user.userId}:${String(i)}`}
                        userId={user.userId}
                        index={i}
                      />
                    )
                  )}
                  {(user.kycDocumentCount ?? 0) === 0 && (
                    <p className="text-xs text-muted-foreground font-medium italic">
                      No documents uploaded.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="rejection-reason" className="text-xs font-medium">
                Rejection Reason (Required for Reject)
              </Label>
              <Textarea
                id="rejection-reason"
                name="rejection-reason"
                placeholder="e.g. Documents are blurry or ID number doesn't match..."
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                }}
                className="border rounded-md"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="border font-semibold text-xs h-12 px-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  onReview("reject");
                }}
                disabled={isKycReasonEmpty || isProcessing}
              >
                {isProcessing ? (
                  <LoadingIndicator size="sm" className="mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Reject Application
              </Button>
              <Button
                className="font-semibold text-xs h-12 px-8 bg-success hover:bg-success/90 text-success-foreground shadow-lg shadow-success/20"
                onClick={() => {
                  onReview("approve");
                }}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <LoadingIndicator size="sm" className="mr-2 border-white" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Approve & Verify
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
