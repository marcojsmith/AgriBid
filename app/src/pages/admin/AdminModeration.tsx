import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Check, AlertTriangle, Flag, ExternalLink, X } from "lucide-react";
import { ModerationCard } from "@/components/admin";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FLAG_REASON_BADGE_VARIANTS } from "@/lib/auction-badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import type { Id } from "convex/_generated/dataModel";

interface PendingFlag {
  _id: Id<"auctionFlags">;
  _creationTime: number;
  auctionId: Id<"auctions">;
  reporterId: string;
  reason: "misleading" | "inappropriate" | "suspicious" | "other";
  details?: string;
  status: "pending" | "reviewed" | "dismissed";
  auctionTitle: string;
  reporterName: string;
}

/**
 * Creates a handler for auction actions with consistent error handling.
 */
function createAuctionActionHandler(
  mutation: (args: { auctionId: Id<"auctions"> }) => Promise<unknown>,
  successMessage: string,
  errorMessage: string
) {
  return async (id: Id<"auctions">) => {
    try {
      await mutation({ auctionId: id });
      toast.success(successMessage);
    } catch (err) {
      console.error(err);
      toast.error(errorMessage);
    }
  };
}

/**
 * Renders the admin moderation page for reviewing and actioning pending auction listings.
 *
 * @returns The AdminLayout React element containing:
 * - a centred loading state while pending auctions are being fetched,
 * - a responsive grid of ModerationCard items with approve, reject and view handlers when data is available,
 * - an empty-state banner when there are no pending auctions.
 */
export default function AdminModeration() {
  const navigate = useNavigate();
  const [selectedFlag, setSelectedFlag] = useState<PendingFlag | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [showDismissDialog, setShowDismissDialog] = useState(false);

  const pendingAuctions = useQuery(api.auctions.getPendingAuctions);
  const allPendingFlags = useQuery(api.auctions.getAllPendingFlags);

  const approveAuctionMutation = useMutation(api.auctions.approveAuction);
  const rejectAuctionMutation = useMutation(api.auctions.rejectAuction);
  const dismissFlagMutation = useMutation(api.auctions.dismissFlag);

  const handleApprove = createAuctionActionHandler(
    approveAuctionMutation,
    "Auction approved",
    "Failed to approve auction"
  );

  const handleReject = createAuctionActionHandler(
    rejectAuctionMutation,
    "Auction rejected",
    "Failed to reject auction"
  );

  const handleDismissFlag = async () => {
    if (!selectedFlag) return;
    try {
      const result = await dismissFlagMutation({
        flagId: selectedFlag._id,
        dismissalReason: dismissReason || undefined,
      });
      if (result.auctionRestored) {
        toast.success("Flag dismissed - auction restored to active");
      } else {
        toast.success("Flag dismissed");
      }
      handleCloseDismissDialog();
    } catch (err) {
      console.error(err);
      toast.error("Failed to dismiss flag");
    }
  };

  const openDismissDialog = (flag: PendingFlag) => {
    setDismissReason("");
    setSelectedFlag(flag);
    setShowDismissDialog(true);
  };

  const handleCloseDismissDialog = () => {
    setShowDismissDialog(false);
    setSelectedFlag(null);
    setDismissReason("");
  };

  if (pendingAuctions === undefined || allPendingFlags === undefined) {
    return (
      <AdminLayout
        title="Moderation Queue"
        subtitle="Review & Approve Pending Listings"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  const flaggedAuctionsCount = allPendingFlags.length;

  return (
    <AdminLayout
      title="Moderation Queue"
      subtitle="Review & Approve Pending Listings"
    >
      <div className="space-y-8">
        {/* Flagged Auctions Section */}
        {flaggedAuctionsCount > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-xl font-bold">Flagged Listings</h2>
              <Badge variant="destructive" className="ml-2">
                {flaggedAuctionsCount}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allPendingFlags.map((flag) => (
                <Card key={flag._id} className="border-destructive/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          {flag.auctionTitle}
                        </CardTitle>
                        <CardDescription>
                          Reported by {flag.reporterName}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          FLAG_REASON_BADGE_VARIANTS[flag.reason] ?? "outline"
                        }
                      >
                        {flag.reason}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {flag.details && (
                      <p className="text-sm text-muted-foreground">
                        {flag.details}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Reported on{" "}
                      {new Date(flag.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/auction/${flag.auctionId}`)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => openDismissDialog(flag)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pending Auctions Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Pending Review</h2>
            <Badge variant="outline" className="ml-2">
              {pendingAuctions.length}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingAuctions.map((auction) => (
              <ModerationCard
                key={auction._id}
                auction={auction}
                onApprove={() => handleApprove(auction._id)}
                onReject={() => handleReject(auction._id)}
                onView={() => navigate(`/auction/${auction._id}`)}
              />
            ))}
          </div>

          {pendingAuctions.length === 0 && flaggedAuctionsCount === 0 && (
            <div className="py-20 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center px-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <Check className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight">
                Queue is Clear
              </h3>
              <p className="text-muted-foreground text-sm max-w-[250px] mt-1">
                All pending auctions have been reviewed. Good work!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dismiss Flag Dialog */}
      <AlertDialog
        open={showDismissDialog}
        onOpenChange={(open) => !open && handleCloseDismissDialog()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Flag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to dismiss this flag?
              {selectedFlag && selectedFlag.auctionTitle && (
                <span className="block mt-2">
                  Auction: <strong>{selectedFlag.auctionTitle}</strong>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="dismiss-reason" className="text-sm font-medium">
              Reason for dismissal (optional)
            </label>
            <Textarea
              id="dismiss-reason"
              placeholder="Explain why this flag is being dismissed..."
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseDismissDialog}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDismissFlag}>
              Dismiss Flag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
