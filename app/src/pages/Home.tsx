// app/src/pages/Home.tsx
import { useState } from "react";
import { useQuery } from "convex/react";
import { useSession } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { api } from "convex/_generated/api";
import { AuctionCard } from "../components/AuctionCard";
import { FilterSidebar } from "../components/FilterSidebar";
import { Link, useSearchParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";

/**
 * Render the AgriBid home page displaying active auctions with a filter sidebar.
 * Accessible to both guest and authenticated users.
 * 
 * @returns The Home page JSX element
 */
export default function Home() {
  const { isPending } = useSession();
  const [searchParams] = useSearchParams();
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Extract filter params
  const searchQuery = searchParams.get("q") || undefined;
  const make = searchParams.get("make") || undefined;
  const minYear = searchParams.get("minYear") ? parseInt(searchParams.get("minYear")!) : undefined;
  const maxYear = searchParams.get("maxYear") ? parseInt(searchParams.get("maxYear")!) : undefined;
  const minPrice = searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!) : undefined;
  const maxHours = searchParams.get("maxHours") ? parseInt(searchParams.get("maxHours")!) : undefined;
  
  const auctions = useQuery(api.auctions.getActiveAuctions, { 
    search: searchQuery,
    make,
    minYear,
    maxYear,
    minPrice,
    maxPrice,
    maxHours
  });
  
  if (isPending) {
    return <div className="flex h-[80vh] items-center justify-center bg-background text-primary animate-pulse font-bold">AGRIBID LOADING...</div>;
  }

  const hasActiveFilters = make || minYear || maxYear || minPrice || maxPrice || maxHours;

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-80 shrink-0 sticky top-24 h-[calc(100vh-8rem)]">
        <FilterSidebar />
      </aside>

      {/* Mobile Filter Overlay */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="absolute inset-y-0 left-0 w-[280px] sm:w-80">
            <FilterSidebar onClose={() => setIsMobileFilterOpen(false)} />
          </div>
          <button 
            className="absolute inset-0 -z-10 w-full h-full"
            onClick={() => setIsMobileFilterOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-primary uppercase">
              {searchQuery ? `Results for "${searchQuery}"` : "Active Auctions"}
            </h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {searchQuery && (
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-muted-foreground hover:text-primary font-bold uppercase text-[10px] tracking-widest"
                  asChild
                >
                  <Link to="/">Clear search results</Link>
                </Button>
              )}
              {hasActiveFilters && !searchQuery && (
                <p className="text-[10px] font-black uppercase text-primary tracking-widest">Filters Applied</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button 
              variant="outline"
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden flex-1 md:flex-none font-bold uppercase tracking-wider h-10 px-6 rounded-xl border-2 gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>
            <Button className="flex-1 md:flex-none font-bold uppercase tracking-wider h-10 px-6 rounded-xl shadow-lg shadow-primary/20" asChild>
              <Link to="/sell">Sell Equipment</Link>
            </Button>
          </div>
        </div>

        {!auctions ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-3xl border-2 border-dashed border-primary/10">
            <div className="text-5xl mb-4">🚜</div>
            <p className="text-muted-foreground font-bold uppercase tracking-widest mb-6 px-4">
              {searchQuery 
                ? `No auctions found matching "${searchQuery}".` 
                : "No auctions found matching your current filters."}
            </p>
            <Button asChild variant="outline" className="rounded-xl font-black px-8 border-2">
              <Link to="/">Clear All Filters</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {auctions.map((auction) => (
              <AuctionCard key={auction._id} auction={auction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}