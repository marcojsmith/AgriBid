// app/src/pages/dashboard/MyListings.tsx
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Plus, Edit, Loader2, Send } from "lucide-react";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import type { Id } from "convex/_generated/dataModel";

/**
 * Renders the current user's auction listings dashboard.
 *
 * Shows a loading indicator while the first page loads, then displays either an empty-state CTA
 * or a paginated list of auction cards with image, metadata, and action buttons.
 *
 * @returns The React element tree for the My Listings dashboard page.
 */
export default function MyListings() {
  const navigate = useNavigate();
  const {
    results: listings,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.auctions.getMyListings,
    {},
    { initialNumItems: 10 }
  );

  const publishAuction = useMutation(api.auctions.publishAuction);

  const handlePublish = async (auctionId: string) => {
    try {
      await publishAuction({ auctionId: auctionId as Id<"auctions"> });
      toast.success("Listing submitted for review!");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to publish listing"));
    }
  };

  const handleEdit = (auction: {
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
    images: unknown;
    startingPrice: number;
    reservePrice: number;
    durationDays?: number;
    status: string;
  }) => {
    // Save to local storage and redirect to /sell
    const draftData = {
      auctionId: auction._id,
      year: auction.year,
      make: auction.make,
      model: auction.model,
      location: auction.location,
      description: auction.description,
      operatingHours: auction.operatingHours,
      title: auction.title,
      conditionChecklist: {
        engine: auction.conditionChecklist?.engine ?? null,
        hydraulics: auction.conditionChecklist?.hydraulics ?? null,
        tires: auction.conditionChecklist?.tires ?? null,
        serviceHistory: auction.conditionChecklist?.serviceHistory ?? null,
        notes: auction.conditionChecklist?.notes ?? "",
      },
      images: auction.images,
      startingPrice: auction.startingPrice,
      reservePrice: auction.reservePrice,
      durationDays: auction.durationDays ?? 7,
    };

    localStorage.setItem("agribid_listing_draft", JSON.stringify(draftData));
    localStorage.setItem("agribid_listing_step", "0");
    navigate("/sell");
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
            localStorage.removeItem("agribid_listing_draft");
            localStorage.removeItem("agribid_listing_step");
            navigate("/sell");
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Listing
        </Button>
      </div>

      {listings.length === 0 ? (
        <div className="max-w-4xl mx-auto space-y-8 py-24 text-center bg-card border-2 border-dashed rounded-3xl border-primary/10">
          <p className="text-muted-foreground text-lg max-w-md mx-auto font-bold uppercase tracking-widest">
            You haven't listed any equipment yet.
          </p>
          <Button
            size="lg"
            className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20"
            asChild
          >
            <Link to="/sell">Start Selling</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((auction) => (
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
                    variant="outline"
                    className="font-bold uppercase tracking-wider shrink-0"
                  >
                    {auction.status.replaceAll("_", " ")}
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

              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 md:flex-none font-bold"
                  asChild
                >
                  <Link to={`/auction/${auction._id}`}>View</Link>
                </Button>

                {(auction.status === "draft" ||
                  auction.status === "pending_review") && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 md:flex-none font-bold"
                    onClick={() => handleEdit(auction)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}

                {auction.status === "draft" && (
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 md:flex-none font-bold bg-green-600 hover:bg-green-700"
                    onClick={() => handlePublish(auction._id)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Publish
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div className="flex justify-center pt-8">
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
