// app/src/pages/AuctionDetail.tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Flag, FileText, Download, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";
import { Helmet } from "react-helmet-async";

import { Button } from "@/components/ui/button";
import { AuctionHeader } from "@/components/AuctionHeader";
import { ImageGallery } from "@/components/ImageGallery";
import { BiddingPanel } from "@/components/bidding/BiddingPanel";
import { BidHistory } from "@/components/bidding/BidHistory";
import { SellerInfo } from "@/components/SellerInfo";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Breadcrumb } from "@/components/Breadcrumb";
import { AuctionCard } from "@/components/auction/AuctionCard";
import { useSession } from "@/lib/auth-client";
import {
  buildTitle,
  buildCanonical,
  buildAuctionDescription,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
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

type FlagReason = "misleading" | "inappropriate" | "suspicious" | "other";

/**
 * Flatten an auction's images object or array into a plain string URL array.
 *
 * @param images - The auction images value (array or object with named fields)
 * @returns Filtered array of resolved image URL strings
 */
function getAuctionImageUrls(
  images:
    | string[]
    | {
        front?: string;
        engine?: string;
        cabin?: string;
        rear?: string;
        additional?: string[];
      }
): string[] {
  if (Array.isArray(images)) {
    return images.filter((url): url is string => !!url);
  }
  return [
    images.front,
    images.engine,
    images.cabin,
    images.rear,
    ...(images.additional ?? []),
  ].filter((url): url is string => !!url);
}

/**
 * Render the auction detail page for the auction referenced by the current route `id`.
 *
 * Renders an "Invalid Auction ID" screen when `id` is undefined, a loading indicator while the auction is being fetched, an "Auction Not Found" screen when no auction exists for `id`, and the full auction UI (header, image gallery, equipment description, bidding panel, bid history and seller information) when the auction is found. Also provides UI to report (flag) a listing and to view or download a condition report when available.
 *
 * @returns The JSX element for the auction detail page.
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

  const relatedAuctions = useQuery(
    api.auctions.getRelatedAuctions,
    auction?.make ? { make: auction.make, excludeId: auction._id } : "skip"
  );

  const flagAuction = useMutation(api.auctions.mutations.publish.flagAuction);

  const isOwner = session?.user?.id === auction?.sellerId;

  const handleFlagAuction = async () => {
    if (!flagReason) {
      toast.error("Please select a reason for flagging");
      return;
    }

    try {
      const normalizedDetails = flagDetails.trim() || undefined;
      const result = await flagAuction({
        auctionId: id as Id<"auctions">,
        reason: flagReason,
        details: normalizedDetails,
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

  const metaDescription = buildAuctionDescription(
    auction.title,
    auction.year,
    auction.make,
    auction.model,
    auction.location
  );
  const pageTitle = buildTitle(auction.title);
  const canonical = buildCanonical(`/auction/${id}`);

  const auctionImageUrls = getAuctionImageUrls(auction.images);
  const ogImage = auctionImageUrls.at(0) ?? DEFAULT_OG_IMAGE;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: auction.title,
    description: auction.description ?? metaDescription,
    image: auctionImageUrls,
    brand: auction.make ? { "@type": "Brand", name: auction.make } : undefined,
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "ZAR",
      price: auction.currentPrice,
      availability:
        auction.status === "active"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      validThrough: auction.endTime
        ? new Date(auction.endTime).toISOString()
        : undefined,
      seller: { "@type": "Organization", name: SITE_NAME },
      ...(auction.location
        ? {
            availableAtOrFrom: {
              "@type": "Place",
              name: auction.location,
              address: {
                "@type": "PostalAddress",
                addressCountry: "ZA",
              },
            },
          }
        : {}),
    },
  };

  const eventSchema = auction.startTime
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: auction.title,
        description: auction.description ?? metaDescription,
        startDate: new Date(auction.startTime).toISOString(),
        ...(auction.endTime
          ? { endDate: new Date(auction.endTime).toISOString() }
          : {}),
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        location: { "@type": "VirtualLocation", url: canonical },
        organizer: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        image: auctionImageUrls,
      }
    : null;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content="en_ZA" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />
        <meta
          name="robots"
          content={auction.status === "active" ? "index, follow" : "noindex"}
        />
        <script type="application/ld+json">
          {JSON.stringify(productSchema)}
        </script>
        {eventSchema && (
          <script type="application/ld+json">
            {JSON.stringify(eventSchema)}
          </script>
        )}
      </Helmet>

      <Breadcrumb
        crumbs={[{ label: "Home", href: "/" }, { label: auction.title }]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Images & Info */}
        <div className="lg:col-span-8 space-y-8">
          <AuctionHeader auction={auction} />

          {auction.startTime && (
            <div className="flex items-center gap-2 text-sm font-bold bg-primary/5 border-2 border-primary/20 rounded-xl px-4 py-3">
              <CalendarClock className="h-4 w-4 text-primary shrink-0" />
              <span className="uppercase tracking-wide text-xs text-primary">
                Auction Starts:{" "}
                {new Date(auction.startTime).toLocaleString("en-ZA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
          )}

          <ImageGallery
            images={getAuctionImageUrls(auction.images)}
            title={auction.title}
          />

          {/* Description Section */}
          <section
            aria-label="Equipment Description"
            className="bg-card border-2 rounded-2xl p-8 space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold uppercase tracking-tight">
                Equipment Description
              </h2>

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
              {(auction.description ?? "").trim().length
                ? auction.description
                : "No description provided."}
            </p>
          </section>

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
                        <label
                          htmlFor="flag-reason"
                          className="text-sm font-medium"
                        >
                          Reason
                        </label>
                        <Select
                          value={flagReason}
                          onValueChange={(v) => {
                            setFlagReason(v as FlagReason);
                          }}
                        >
                          <SelectTrigger id="flag-reason">
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
                        <label
                          htmlFor="flag-details"
                          className="text-sm font-medium"
                        >
                          Additional details (optional)
                        </label>
                        <Textarea
                          id="flag-details"
                          name="flag-details"
                          placeholder="Provide more context..."
                          value={flagDetails}
                          onChange={(e) => {
                            setFlagDetails(e.target.value);
                          }}
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setFlagDialogOpen(false);
                          }}
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

          {/* Related Auctions */}
          {relatedAuctions && relatedAuctions.length > 0 && (
            <section aria-label={`More ${auction.make} Equipment`}>
              <h2 className="text-lg font-black uppercase tracking-tight mb-4">
                More {auction.make} Equipment
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedAuctions.map((related) => (
                  <AuctionCard
                    key={related._id}
                    auction={related}
                    viewMode="compact"
                    isWatched={false}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Bidding Panel */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 space-y-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto pr-2">
            <aside
              aria-label="Bidding"
              className="bg-card border-2 border-primary/20 rounded-2xl p-6"
            >
              <BiddingPanel auction={auction} />
            </aside>

            <section
              aria-label="Bid History"
              className="bg-card border-2 rounded-2xl p-6"
            >
              <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">
                Bid History
              </h2>
              <BidHistory auctionId={auction._id} />
            </section>

            <SellerInfo sellerId={auction.sellerId} />
          </div>
        </div>
      </div>

      {/* Condition Report Viewer Dialog */}
      <Dialog open={conditionReportOpen} onOpenChange={setConditionReportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Condition Report</DialogTitle>
            <DialogDescription>
              Detailed condition and inspection report for this equipment.
            </DialogDescription>
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
