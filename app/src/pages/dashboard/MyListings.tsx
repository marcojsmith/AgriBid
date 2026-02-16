// app/src/pages/dashboard/MyListings.tsx
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Plus, Edit } from "lucide-react";

/**
 * Renders the "My Listings" dashboard page showing the current user's auction listings.
 *
 * Displays a centered loading spinner while listings are being fetched. When data is available,
 * shows a header with a "Create Listing" action, an empty-state call-to-action if there are no
 * listings, or a list of auction cards with image, title, status badge, reserve/current prices,
 * end date, and actions (View; Edit shown but disabled for drafts).
 *
 * @returns The React element tree for the My Listings dashboard page.
 */
export default function MyListings() {
  const listings = useQuery(api.auctions.getMyListings);

  if (listings === undefined) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-primary uppercase">My Listings</h1>
        </div>
        <Button size="lg" className="rounded-xl font-bold shadow-lg shadow-primary/20" asChild>
          <Link to="/sell">
            <Plus className="h-4 w-4 mr-2" />
            Create Listing
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <div className="max-w-4xl mx-auto space-y-8 py-24 text-center bg-card border-2 border-dashed rounded-3xl border-primary/10">
          <p className="text-muted-foreground text-lg max-w-md mx-auto font-bold uppercase tracking-widest">
            You haven't listed any equipment yet.
          </p>
          <Button size="lg" className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20" asChild>
            <Link to="/sell">Start Selling</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((auction) => (
            <div key={auction._id} className="bg-card border-2 rounded-2xl p-4 flex flex-col md:flex-row gap-6 items-start md:items-center group hover:border-primary/50 transition-colors">
              <div className="w-full md:w-48 aspect-video bg-muted rounded-xl overflow-hidden shrink-0">
                {(!Array.isArray(auction.images) && auction.images.front) && (
                  <img src={auction.images.front} alt={auction.title} className="w-full h-full object-cover" />
                )}
                {Array.isArray(auction.images) && auction.images[0] && (
                  <img src={auction.images[0]} alt={auction.title} className="w-full h-full object-cover" />
                )}
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-bold text-xl leading-tight">{auction.title}</h3>
                  <Badge variant="outline" className="font-bold uppercase tracking-wider shrink-0">
                    {auction.status.replaceAll('_', ' ')}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="font-medium">Reserve: R {auction.reservePrice.toLocaleString('en-ZA')}</span>
                  <span className="font-medium">Current: <span className="text-primary font-bold">R {auction.currentPrice.toLocaleString('en-ZA')}</span></span>
                  <span>{new Date(auction.endTime).toLocaleDateString('en-ZA')}</span>
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="outline" className="flex-1 md:flex-none font-bold" asChild>
                  <Link to={`/auction/${auction._id}`}>View</Link>
                </Button>
                {auction.status === 'draft' && (
                  <Button variant="secondary" className="flex-1 md:flex-none font-bold" disabled>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit (Soon)
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}