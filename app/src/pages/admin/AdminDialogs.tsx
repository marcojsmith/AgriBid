// app/src/pages/admin/AdminDialogs.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { DetailItem } from "@/components/admin";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

interface KycReviewUser {
  userId: string;
  firstName?: string;
  lastName?: string;
  idNumber?: string;
  phoneNumber?: string;
  kycEmail?: string;
  kycDocuments?: string[];
}

interface AdminProfile {
  _id: Id<"profiles">;
  userId: string;
  name?: string;
  email?: string;
  role: string;
}

/**
 * KYC Review Dialog Component
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">
            KYC Verification Review
          </DialogTitle>
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
                          ? user.idNumber || "Not Provided"
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
                        onClick={() => setShowFullId(!showFullId)}
                      >
                        {showFullId ? "Hide" : "Reveal"}
                      </Button>
                    )}
                  </div>
                  <DetailItem
                    label="Phone"
                    value={user.phoneNumber || "Not Provided"}
                    icon={<Phone className="h-4 w-4" />}
                  />
                  <DetailItem
                    label="Email"
                    value={user.kycEmail || "Not Provided"}
                    icon={<Mail className="h-4 w-4" />}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Submitted Documents
                </h3>
                <div className="space-y-2">
                  {user.kycDocuments?.map((url: string, i: number) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="w-full justify-start font-bold uppercase text-[10px] h-10 border-2 gap-2"
                      onClick={() => {
                        try {
                          if (!url || typeof url !== "string")
                            throw new Error("Missing document URL");
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch (err) {
                          console.error("KYC Document Access Error:", err);
                          toast.error("Invalid or restricted document link");
                        }
                      }}
                    >
                      <Eye className="h-3 w-3" /> View Document {i + 1}
                    </Button>
                  ))}
                  {(!user.kycDocuments || user.kycDocuments.length === 0) && (
                    <p className="text-xs text-muted-foreground font-medium italic">
                      No documents uploaded.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-[10px] font-black uppercase tracking-widest">
                Rejection Reason (Required for Reject)
              </Label>
              <Textarea
                placeholder="e.g. Documents are blurry or ID number doesn't match..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="border-2 rounded-xl"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="border-2 font-black uppercase text-xs h-12 px-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onReview("reject")}
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
                onClick={() => onReview("approve")}
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

/**
 * Bulk Action Confirmation Dialog
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
              {targetStatus}
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

/**
 * Promote Action Confirmation Dialog
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
