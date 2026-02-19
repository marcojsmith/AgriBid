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
import { Input } from "@/components/ui/input";
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
import { useAdminDashboard } from "./context/useAdminDashboard";
import { toast } from "sonner";

export function AdminDialogs() {
  const {
    announcementOpen,
    setAnnouncementOpen,
    announcementTitle,
    setAnnouncementTitle,
    announcementMessage,
    setAnnouncementMessage,
    handleSendAnnouncement,
    kycReviewUser,
    setKycReviewUser,
    showFullId,
    setShowFullId,
    kycRejectionReason,
    setKycRejectionReason,
    handleKycReview,
    bulkStatusTarget,
    setBulkStatusTarget,
    selectedAuctions,
    isBulkProcessing,
    handleBulkStatusUpdate,
    promoteTarget,
    setPromoteTarget,
    isPromoting,
    handlePromote,
  } = useAdminDashboard();

  const isAnnouncementEmpty = !announcementTitle.trim() || !announcementMessage.trim();
  const isKycReasonEmpty = !kycRejectionReason.trim();

  return (
    <>
      {/* Announcement Dialog */}
      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="Maintenance Update"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                placeholder="We will be offline for..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleSendAnnouncement} 
              disabled={isAnnouncementEmpty}
            >
              Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KYC Review Dialog */}
      <Dialog
        open={!!kycReviewUser}
        onOpenChange={(open) => {
          if (!open) {
            setKycReviewUser(null);
            setShowFullId(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
              KYC Verification Review
            </DialogTitle>
          </DialogHeader>
          {kycReviewUser && (
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
                        [kycReviewUser.firstName, kycReviewUser.lastName]
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
                            ? kycReviewUser.idNumber || "Not Provided"
                            : kycReviewUser.idNumber
                              ? `****${kycReviewUser.idNumber.slice(-4)}`
                              : "Not Provided"
                        }
                        icon={<Fingerprint className="h-4 w-4" />}
                      />
                      {kycReviewUser.idNumber && (
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
                      value={kycReviewUser.phoneNumber || "Not Provided"}
                      icon={<Phone className="h-4 w-4" />}
                    />
                    <DetailItem
                      label="Email"
                      value={kycReviewUser.kycEmail || "Not Provided"}
                      icon={<Mail className="h-4 w-4" />}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <FileText className="h-3 w-3" /> Submitted Documents
                  </h3>
                  <div className="space-y-2">
                    {kycReviewUser.kycDocuments?.map(
                      (url: string, i: number) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="w-full justify-start font-bold uppercase text-[10px] h-10 border-2 gap-2"
                          onClick={() => {
                            try {
                              if (!url || typeof url !== "string")
                                throw new Error("Missing document URL");
                              const parsed = new URL(url);
                              if (
                                parsed.protocol !== "http:" &&
                                parsed.protocol !== "https:"
                              )
                                throw new Error("Invalid protocol");
                              window.open(url, "_blank", "noopener,noreferrer");
                            } catch (err) {
                              console.error("KYC Document Access Error:", err);
                              toast.error(
                                "Invalid or restricted document link",
                              );
                            }
                          }}
                        >
                          <Eye className="h-3 w-3" /> View Document {i + 1}
                        </Button>
                      ),
                    )}
                    {(!kycReviewUser.kycDocuments ||
                      kycReviewUser.kycDocuments.length === 0) && (
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
                  value={kycRejectionReason}
                  onChange={(e) => setKycRejectionReason(e.target.value)}
                  className="border-2 rounded-xl"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-2 font-black uppercase text-xs h-12 px-8 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleKycReview("reject")}
              disabled={isKycReasonEmpty}
            >
              <X className="h-4 w-4 mr-2" /> Reject Application
            </Button>
            <Button
              className="font-black uppercase text-xs h-12 px-8 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
              onClick={() => handleKycReview("approve")}
            >
              <Check className="h-4 w-4 mr-2" /> Approve & Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Confirmation */}
      <AlertDialog
        open={!!bulkStatusTarget}
        onOpenChange={(open) => !open && setBulkStatusTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">
              Perform Bulk Status Update?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-sm">
              You are about to update{" "}
              <span className="font-bold text-primary">
                {selectedAuctions.length} auctions
              </span>{" "}
              to status{" "}
              <span className="font-bold text-primary uppercase">
                {bulkStatusTarget}
              </span>
              . This action is auditable and affects marketplace visibility.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-2 font-bold uppercase text-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkStatusUpdate}
              disabled={isBulkProcessing}
              className="rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px]"
            >
              {isBulkProcessing ? (
                <LoadingIndicator size="sm" className="mr-2" />
              ) : null}
              Confirm Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote Action Confirmation */}
      <AlertDialog
        open={!!promoteTarget}
        onOpenChange={(open) => !open && setPromoteTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight text-destructive">
              Elevate to Admin Role?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-sm">
              You are about to promote{" "}
              <span className="font-bold text-primary">{promoteTarget?.name}</span>{" "}
              to an administrative role. This grants full access to the Command Center and
              system settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl border-2 font-bold uppercase text-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePromote}
              disabled={isPromoting}
              className="rounded-xl bg-destructive text-destructive-foreground font-black uppercase text-[10px]"
            >
              {isPromoting ? (
                <LoadingIndicator size="sm" className="mr-2" />
              ) : null}
              Promote User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
