// app/src/pages/AuctionContainerDetail.tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Calendar, Image as ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingPage } from "@/components/LoadingIndicator";
import { LotBrowser } from "@/components/LotBrowser";
import { buildTitle, buildCanonical, DEFAULT_DESCRIPTION } from "@/lib/seo";

/**
 * Public detail page for a scheduled auction container, showing the container
 * banner and header above a full lot browser scoped to the auction's lots.
 * Only published/closed containers are reachable; draft containers resolve to
 * a not-found state.
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
  // Lazy initializer keeps this a pure read during render (the "Live Now"
  // badge doesn't need to tick; a page refresh is enough).
  const [now] = useState(() => Date.now());

  if (auction === undefined) {
    return <LoadingPage message="Loading auction..." />;
  }

  if (auction === null) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center space-y-4">
        <h1 className="text-2xl font-bold">Auction Not Found</h1>
        <p className="text-muted-foreground">
          This auction may not exist or is not yet published.
        </p>
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace
          </Link>
        </Button>
      </div>
    );
  }

  const isLive =
    auction.status === "published" &&
    auction.startTime <= now &&
    now < auction.endTime;

  return (
    <div className="space-y-8">
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

      <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" /> Back to Marketplace
        </Link>
      </Button>

      <div className="relative h-56 md:h-72 rounded-lg overflow-hidden bg-muted border">
        {auction.bannerImageUrl ? (
          <img
            src={auction.bannerImageUrl}
            alt={auction.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        {isLive && (
          <Badge className="absolute top-3 right-3 bg-success/90 text-success-foreground font-semibold animate-pulse">
            Live Now
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          {auction.title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {new Date(auction.startTime).toLocaleString()} –{" "}
            {new Date(auction.endTime).toLocaleString()}
          </span>
          <Badge className="capitalize">{auction.status}</Badge>
        </div>
        {auction.description && (
          <p className="text-muted-foreground max-w-3xl mt-2">
            {auction.description}
          </p>
        )}
      </div>

      <LotBrowser auctionId={auction._id} showSellButton={false} />
    </div>
  );
}
