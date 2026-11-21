// app/src/pages/AuctionContainerDetail.tsx
import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingPage } from "@/components/LoadingIndicator";
import { EventLotBrowser } from "@/components/auction-event/EventLotBrowser";
import { SaleHeader } from "@/components/auction-event/SaleHeader";
import { SaleTerms } from "@/components/ds/SaleTerms";
import { useVatRate } from "@/hooks/useVatRate";
import { buildTitle, buildCanonical, DEFAULT_DESCRIPTION } from "@/lib/seo";

/**
 * Converts the stored buyer's premium (a fraction, 0.05 = 5%) into a
 * percentage for display, without floating-point noise.
 *
 * @param fraction - The stored rate, or undefined when unset
 * @returns The percentage, or undefined when unset
 */
function premiumPercent(fraction: number | undefined): number | undefined {
  return fraction === undefined
    ? undefined
    : Math.round(fraction * 10_000) / 100;
}

/**
 * Public page for one auction event (`/auctions/:id`): a sale summary header
 * with a countdown, the platform-wide sale terms (with this sale's buyer's
 * premium and the VAT rate), then the filterable lot grid.
 *
 * Only published or closed sales are reachable; a draft or unknown id shows a
 * not-found state.
 *
 * @returns The AuctionContainerDetail page component.
 */
export default function AuctionContainerDetail() {
  const { id } = useParams<{ id: string }>();
  const auctionId = id as Id<"auctions"> | undefined;
  const auction = useQuery(
    api.auctions.getPublishedAuction,
    auctionId ? { auctionId } : "skip"
  );
  const vatPct = useVatRate();

  if (auction === undefined) {
    return <LoadingPage message="Loading auction..." />;
  }

  if (auction === null) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-4">
        <h1 className="text-2xl font-bold">Auction not found</h1>
        <p className="text-muted-foreground">
          This auction may not exist or is not yet published.
        </p>
        <Button asChild variant="outline">
          <Link to="/auctions">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to auctions
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Helmet>
        <title>{buildTitle(auction.title)}</title>
        <meta
          name="description"
          content={auction.description ?? DEFAULT_DESCRIPTION}
        />
        <link
          rel="canonical"
          href={buildCanonical(`/auctions/${auction._id}`)}
        />
      </Helmet>

      <Link
        to="/auctions"
        className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-sm px-1 text-sm font-medium text-muted-foreground hover:text-foreground lg:min-h-0"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All auctions
      </Link>

      <SaleHeader auction={auction} />

      <div className="border-y border-border py-4">
        <SaleTerms
          buyersPremiumPct={premiumPercent(auction.defaultBuyerPremiumPct)}
          vatPct={vatPct}
          rulesHref="/faq"
          className="[&>dl]:grid-cols-2 lg:[&>dl]:grid-cols-3"
        />
      </div>

      <EventLotBrowser auctionId={auction._id} />
    </div>
  );
}
