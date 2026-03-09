// app/src/pages/dashboard/MyListings.tsx
import { useState, useMemo } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  Edit,
  Trash2,
  Send,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import {
  AUCTION_STATUS_BADGE_VARIANTS,
  getAuctionStatusLabel,
} from "@/lib/auction-badges";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { normalizeListingImages } from "@/lib/normalize-images";

type StatusFilter =
  | "all"
  | "draft"
  | "pending_review"
  | "active"
  | "sold"
  | "unsold";

export interface AuctionEditPayload {
  _id: Id<"auctions">;
  year: number;
  make: string;
  model: string;
  location: string;
  description?: string;
  operatingHours: number;
  title: string;
  conditionChecklist?: {
    engine: boolean | null;
    hydraulics: boolean | null;
    tires: boolean | null;
    serviceHistory: boolean | null;
    notes?: string;
  };
  images:
    | {
        front?: string;
        engine?: string;
        cabin?: string;
        rear?: string;
        additional?: string[];
      }
    | string[];
  startingPrice: number;
  reservePrice: number;
  durationDays?: number;
  status: string;
  currentPrice: number;
  endTime?: number;
}

/**
 * Renders the current user's auction listings dashboard.
 *
 * Shows a loading indicator while the first page loads, then displays either an empty-state CTA
 * or a paginated list of auction cards with image, metadata, and action buttons.
 *
 * @returns The React element tree for the My Listings dashboard page.
 */
export default function MyListings() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    results: listings,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getMyListings,
    {},
    { initialNumItems: 50 }
  );

  const listingStats = useQuery(api.auctions.getMyListingsStats);
  const submitForReview = useMutation(api.auctions.submitForReview);
  const deleteDraft = useMutation(api.auctions.deleteDraft);

  const filteredListings = useMemo(() => {
    if (statusFilter === "all") return listings;
    return listings.filter((listing) => listing.status === statusFilter);
  }, [listings, statusFilter]);

  const handleSubmitForReview = async (auctionId: Id<"auctions">) => {
    if (publishingId) return;
    setPublishingId(auctionId);
    try {
      await submitForReview({ auctionId });
      toast.success("Listing submitted for review!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit for review"
      );
    } finally {
      setPublishingId(null);
    }
  };

  const handleDeleteDraft = async (auctionId: Id<"auctions">) => {
    try {
      setDeletingId(auctionId);
      await deleteDraft({ auctionId });
      toast.success("Draft deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete draft"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (auction: (typeof listings)[0]) => {
    // Save to local storage and redirect to /sell?edit=ID
    const draftData = {
      auctionId: auction._id,
      year: auction.year,
      make: auction.make,
      model: auction.model,
      location: auction.location,
      description: auction.description ?? "",
      operatingHours: auction.operatingHours,
      title: auction.title,
      conditionChecklist: {
        engine: auction.conditionChecklist?.engine ?? null,
        hydraulics: auction.conditionChecklist?.hydraulics ?? null,
        tires: auction.conditionChecklist?.tires ?? null,
        serviceHistory: auction.conditionChecklist?.serviceHistory ?? null,
        notes: auction.conditionChecklist?.notes ?? "",
      },
      images: normalizeListingImages(auction.images),
      startingPrice: auction.startingPrice,
      reservePrice: auction.reservePrice,
      durationDays: auction.durationDays ?? 7,
    };

    try {
      localStorage.setItem("agribid_listing_draft", JSON.stringify(draftData));
      localStorage.setItem("agribid_listing_step", "0");
    } catch (e) {
      console.warn("Failed to save draft to localStorage:", e);
    }
    navigate(`/sell?edit=${auction._id}`);
  };

  const getStatusCount = (status: StatusFilter) => {
    if (!listingStats) return 0;
    return listingStats[status] ?? 0;
  };

  if (status === "LoadingFirstPage") {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-primary uppercase">
            My Listings
          </h1>
        </div>
        <Button
          size="lg"
          className="rounded-xl font-bold shadow-lg shadow-primary/20"
          onClick={() => {
            try {
              localStorage.removeItem("agribid_listing_draft");
              localStorage.removeItem("agribid_listing_step");
            } catch (e) {
              console.warn("Failed to clear localStorage:", e);
            } finally {
              navigate("/sell");
            }
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Listing
        </Button>
      </div>

      <Tabs
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as StatusFilter)}
      >
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="all" className="flex-1 min-w-[80px]">
            All ({getStatusCount("all")})
          </TabsTrigger>
          <TabsTrigger value="draft" className="flex-1 min-w-[80px]">
            Drafts ({getStatusCount("draft")})
          </TabsTrigger>
          <TabsTrigger value="pending_review" className="flex-1 min-w-[80px]">
            Pending ({getStatusCount("pending_review")})
          </TabsTrigger>
          <TabsTrigger value="active" className="flex-1 min-w-[80px]">
            Active ({getStatusCount("active")})
          </TabsTrigger>
          <TabsTrigger value="sold" className="flex-1 min-w-[80px]">
            Sold ({getStatusCount("sold")})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filteredListings.length === 0 ? (
        <div className="max-w-4xl mx-auto space-y-8 py-24 text-center bg-card border-2 border-dashed rounded-3xl border-primary/10">
          <p className="text-muted-foreground text-lg max-w-md mx-auto font-bold uppercase tracking-widest">
            {statusFilter === "all"
              ? "You haven't listed any equipment yet."
              : `No listings with status: ${statusFilter.replace("_", " ")}`}
          </p>
          {statusFilter === "all" && (
            <Button
              size="lg"
              className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20"
              asChild
            >
              <Link to="/sell">Start Selling</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredListings.map((auction) => (
            <div
              key={auction._id}
              className="bg-card border-2 rounded-2xl p-4 flex flex-col md:flex-row gap-6 items-start md:items-center group hover:border-primary/50 transition-colors"
            >
              <div className="w-full md:w-48 aspect-video bg-muted rounded-xl overflow-hidden shrink-0">
                {!Array.isArray(auction.images) && auction.images.front && (
                  <img
                    src={auction.images.front}
                    alt={auction.title}
                    className="w-full h-full object-cover"
                  />
                )}
                {Array.isArray(auction.images) && auction.images[0] && (
                  <img
                    src={auction.images[0]}
                    alt={auction.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-bold text-xl leading-tight">
                    {auction.title}
                  </h3>
                  <Badge
                    variant={
                      AUCTION_STATUS_BADGE_VARIANTS[auction.status] ?? "outline"
                    }
                    className="font-bold uppercase tracking-wider shrink-0"
                  >
                    {getAuctionStatusLabel(auction.status)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="font-medium">
                    Reserve: R {auction.reservePrice.toLocaleString("en-ZA")}
                  </span>
                  <span className="font-medium">
                    Current:{" "}
                    <span className="text-primary font-bold">
                      R {auction.currentPrice.toLocaleString("en-ZA")}
                    </span>
                  </span>
                  <span>
                    {auction.endTime
                      ? new Date(auction.endTime).toLocaleDateString("en-ZA")
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 md:flex-none font-bold"
                  asChild
                >
                  <Link to={`/auction/${auction._id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Link>
                </Button>

                {(auction.status === "draft" ||
                  auction.status === "pending_review") && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 md:flex-none font-bold"
                      onClick={() => handleEdit(auction)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    {auction.status === "draft" && (
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 md:flex-none font-bold"
                        disabled={publishingId === auction._id}
                        onClick={() => handleSubmitForReview(auction._id)}
                      >
                        {publishingId === auction._id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Submit
                      </Button>
                    )}
                    {auction.status === "draft" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 md:flex-none font-bold"
                            disabled={deletingId === auction._id}
                          >
                            {deletingId === auction._id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Draft</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this draft? This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDraft(auction._id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          <div className="flex flex-col items-center gap-4 pt-8">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">
              Showing {filteredListings.length}
              {getStatusCount(statusFilter) > 0
                ? ` of ${getStatusCount(statusFilter)}`
                : ""}{" "}
              Listings
            </p>
            {status === "CanLoadMore" ? (
              <Button
                variant="outline"
                onClick={() => loadMore(10)}
                className="font-bold min-w-[200px]"
              >
                Load More Listings
              </Button>
            ) : status === "LoadingMore" ? (
              <Button disabled variant="outline" className="min-w-[200px]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
