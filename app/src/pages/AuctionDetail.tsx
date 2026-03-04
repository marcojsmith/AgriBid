// app/src/pages/AuctionDetail.tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { ArrowLeft, Flag, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AuctionHeader } from "@/components/AuctionHeader";
import { ImageGallery } from "@/components/ImageGallery";
import { BiddingPanel, BidHistory } from "@/components/bidding";
import { SellerInfo } from "@/components/SellerInfo";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useSession } from "@/lib/auth-client";

type FlagReason = "misleading" | "inappropriate" | "suspicious" | "other";

/**
 * Display the auction detail page for the auction identified by the current route `id`.
 *
 * Shows an "Invalid Auction ID" message when the route `id` is missing, a loading indicator while data is being fetched, and an "Auction Not Found" message when no auction exists for the given `id`. When the auction exists, renders the auction header, image gallery, equipment description, bidding panel with bid history, and seller information.
 *
 * @returns A JSX element representing the auction detail page
 */
export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isPending: sessionLoading } = useSession();
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagReason, setFlagReason] = useState<FlagReason | "">("");
  const [flagDetails, setFlagDetails] = useState("");
  const [conditionReportOpen, setConditionReportOpen] = useState(false);

  const auction = useQuery(
    api.auctions.getAuctionById,
    id ? { auctionId: id as Id<"auctions"> } : "skip"
  );

  const flagAuction = useMutation(api.auctions.flagAuction);

  const isOwner = session?.user?.email === auction?.sellerEmail;

  const handleFlagAuction = async () => {
    if (!flagReason) {
      toast.error("Please select a reason for flagging");
      return;
    }

    try {
      const result = await flagAuction({
        auctionId: id as Id<"auctions">,
        reason: flagReason as FlagReason,
        details: flagDetails || undefined,
      });

      if (result.hideTriggered) {
        toast.success("Auction has been flagged and hidden for review");
      } else {
        toast.success("Thank you for your report");
      }
      setFlagDialogOpen(false);
      setFlagReason("");
      setFlagDetails("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to flag auction"
      );
    }
  };

  const handleViewConditionReport = () => {
    if (!auction?.conditionReportUrl) return;
    setConditionReportOpen(true);
  };

  if (id === undefined) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center bg-background gap-4">
        <h2 className="text-2xl font-bold">Invalid Auction ID</h2>
        <Button asChild>
          <Link to="/">Return to Home</Link>
        </Button>
      </div>
    );
  }

  if (auction === undefined) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-background">
        <LoadingIndicator />
      </div>
    );
  }

  if (auction === null) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center bg-background gap-4">
        <h2 className="text-2xl font-bold">Auction Not Found</h2>
        <Button asChild>
          <Link to="/">Return to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="ghost" asChild className="mb-6 -ml-4">
        <Link to="/" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Images & Info */}
        <div className="lg:col-span-8 space-y-8">
          <AuctionHeader auction={auction} />

          <ImageGallery
            images={
              Array.isArray(auction.images)
                ? auction.images.filter((url): url is string => !!url)
                : [
                    auction.images.front,
                    auction.images.engine,
                    auction.images.cabin,
                    auction.images.rear,
                    ...(auction.images.additional || []),
                  ].filter((url): url is string => !!url)
            }
            title={auction.title}
          />

          {/* Description Section */}
          <div className="bg-card border-2 rounded-2xl p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-xl font-bold uppercase tracking-tight">
                Equipment Description
              </h3>

              {auction.conditionReportUrl && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold gap-2 border-primary/20 hover:bg-primary/5"
                    onClick={handleViewConditionReport}
                  >
                    <FileText className="h-4 w-4 text-primary" />
                    View Report
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl font-bold gap-2 border-primary/20 hover:bg-primary/5"
                    asChild
                  >
                    <a
                      href={auction.conditionReportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4 text-primary" />
                      Download PDF
                    </a>
                  </Button>
                </div>
              )}
            </div>

            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {auction.description || "No description provided."}
            </p>
          </div>

          {/* Flag Button (for non-owners) */}
          {!sessionLoading && session && !isOwner && (
            <div className="bg-card border-2 border-destructive/20 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-bold text-sm">See something wrong?</h4>
                  <p className="text-xs text-muted-foreground">
                    Report this listing if it violates our terms of service
                  </p>
                </div>
                <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-2">
                      <Flag className="h-4 w-4" />
                      Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Report this Listing</DialogTitle>
                      <DialogDescription>
                        Help us understand what's wrong with this listing
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Reason</label>
                        <Select
                          value={flagReason}
                          onValueChange={(v) => setFlagReason(v as FlagReason)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="misleading">
                              Misleading information
                            </SelectItem>
                            <SelectItem value="inappropriate">
                              Inappropriate content
                            </SelectItem>
                            <SelectItem value="suspicious">
                              Suspicious activity
                            </SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Additional details (optional)
                        </label>
                        <Textarea
                          placeholder="Provide more context..."
                          value={flagDetails}
                          onChange={(e) => setFlagDetails(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setFlagDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleFlagAuction}
                        >
                          Submit Report
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Bidding Panel */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 space-y-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto pr-2">
            <div className="bg-card border-2 border-primary/20 rounded-2xl p-6">
              <BiddingPanel auction={auction} />
            </div>

            <div className="bg-card border-2 rounded-2xl p-6">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">
                Bid History
              </h3>
              <BidHistory auctionId={auction._id} />
            </div>

            <SellerInfo sellerId={auction.sellerId} />
          </div>
        </div>
      </div>

      {/* Condition Report Viewer Dialog */}
      <Dialog open={conditionReportOpen} onOpenChange={setConditionReportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Condition Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {auction.conditionReportUrl ? (
              <iframe
                src={auction.conditionReportUrl}
                className="w-full h-[70vh] rounded border"
                title="Condition Report"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[40vh] text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p>No condition report available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
