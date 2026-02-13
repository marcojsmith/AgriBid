// app/src/pages/AuctionDetail.tsx
import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "../components/ui/button";
import { ArrowLeft, Share2, Heart } from "lucide-react";
import { AuctionHeader } from "../components/AuctionHeader";
import { ImageGallery } from "../components/ImageGallery";
import { BiddingPanel } from "../components/BiddingPanel";
import { BidHistory } from "../components/BidHistory";
import { SellerInfo } from "../components/SellerInfo";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Render the detailed auction page for the auction identified by the current route `id`.
 *
 * Renders a fullscreen loading spinner while the auction is being fetched, a "Auction Not Found" screen if no auction exists for the given id, and otherwise a two-column layout showing the auction header, image gallery, equipment description, bidding panel with bid history, and seller information.
 *
 * @returns The auction detail page as a JSX element.
 */
export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  
  const auction = useQuery(
    api.auctions.getAuctionById, 
    id ? { auctionId: id as Id<"auctions"> } : "skip"
  );

  if (id === undefined) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background gap-4">
        <h2 className="text-2xl font-bold">Invalid Auction ID</h2>
        <Button asChild>
          <Link to="/">Return to Home</Link>
        </Button>
      </div>
    );
  }

  if (auction === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (auction === null) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background gap-4">
        <h2 className="text-2xl font-bold">Auction Not Found</h2>
        <Button asChild>
          <Link to="/">Return to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Detail Navbar */}
      <header className="border-b bg-card px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-2xl font-black tracking-tighter text-primary">AGRIBID</Link>
          <div className="h-6 w-px bg-muted mx-2 hidden md:block" />
          <nav className="hidden md:flex gap-4 text-sm font-medium">
            <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">Marketplace</Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground">{auction.make}</span>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Share listing">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Add to favorites">
            <Heart className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
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
            
            <ImageGallery images={auction.images || []} title={auction.title} />

            {/* Description Section */}
            <div className="bg-card border-2 rounded-2xl p-8 space-y-4">
              <h3 className="text-xl font-bold uppercase tracking-tight">Equipment Description</h3>
              <p className="text-muted-foreground leading-relaxed">
                This {auction.year} {auction.make} {auction.model} is in excellent condition with only {auction.operatingHours.toLocaleString()} operating hours. 
                Full service history available and verified by our engineering team. Located in {auction.location}.
              </p>
            </div>
          </div>

          {/* Right Column: Bidding Panel */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 space-y-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto pr-2">
              <div className="bg-card border-2 border-primary/20 rounded-2xl p-6">
                <BiddingPanel auction={auction} />
              </div>

              <div className="bg-card border-2 rounded-2xl p-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Bid History</h3>
                <BidHistory auctionId={auction._id} />
              </div>

              <SellerInfo sellerId={auction.sellerId} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}