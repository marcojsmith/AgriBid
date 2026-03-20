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
import { DetailItem } from "@/components/admin";
import type { KycReviewUser } from "@/hooks/admin/useUserManagement";

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
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">
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
                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
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
                          ? (user.idNumber ?? "Not Provided")
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
                        className="h-6 px-2 text-[8px] font-black uppercase absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
                    value={user.phoneNumber ?? "Not Provided"}
                    icon={<Phone className="h-4 w-4" />}
                  />
                  <DetailItem
                    label="Email"
                    value={user.kycEmail ?? "Not Provided"}
                    icon={<Mail className="h-4 w-4" />}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Submitted Documents
                </h3>
                <div className="space-y-2">
                  {user.kycDocumentUrls?.map((url: string, i: number) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-start font-bold uppercase text-[10px] h-10 border-2 gap-2"
                      onClick={() => {
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <Eye className="h-3 w-3" /> View Document {i + 1}
                    </Button>
                  ))}
                  {(!user.kycDocumentUrls ||
                    user.kycDocumentUrls.length === 0) && (
                    <p className="text-xs text-muted-foreground font-medium italic">
                      No documents uploaded.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label
                htmlFor="rejection-reason"
                className="text-[10px] font-black uppercase tracking-widest"
              >
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
                className="border-2 rounded-xl"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="border-2 font-black uppercase text-xs h-12 px-8 hover:bg-destructive/10 hover:text-destructive"
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
                className="font-black uppercase text-xs h-12 px-8 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
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
