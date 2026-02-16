// app/src/pages/Home.tsx
import { useQuery } from "convex/react";
import { useSession } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { api } from "convex/_generated/api";
import { AuctionCard } from "../components/AuctionCard";
import type { Doc } from "convex/_generated/dataModel";
import { Link, useSearchParams } from "react-router-dom";

/**
 * Render the AgriBid home page displaying active auctions.
 * Accessible to both guest and authenticated users.
 * 
 * @returns The Home page JSX element
 */
export default function Home() {
  const { isPending } = useSession();
  const [searchParams] = useSearchParams();
  const rawQuery = searchParams.get("q") || "";
  const searchQuery = rawQuery.trim() === "" ? undefined : rawQuery.trim();
  
  const auctions = useQuery(api.auctions.getActiveAuctions, { search: searchQuery });
  
  if (isPending) {
    return <div className="flex h-[80vh] items-center justify-center bg-background text-primary animate-pulse font-bold">AGRIBID LOADING...</div>;
  }

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">
            {searchQuery ? `Results for "${searchQuery}"` : "Active Auctions"}
          </h2>
          {searchQuery && (
            <Button 
              variant="link" 
              className="p-0 h-auto text-muted-foreground hover:text-primary font-bold uppercase text-[10px] tracking-widest"
              asChild
            >
              <Link to="/">Clear search results</Link>
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="font-bold uppercase tracking-wider h-10 px-6 rounded-xl" asChild>
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
          <p className="text-muted-foreground font-bold uppercase tracking-widest mb-6">
            {searchQuery 
              ? `No auctions found matching "${searchQuery}".` 
              : "No active auctions at the moment."}
          </p>
          {searchQuery && (
            <Button asChild className="rounded-xl font-black px-8">
              <Link to="/">View All Auctions</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {auctions.map((auction: Doc<"auctions">) => (
            <AuctionCard key={auction._id} auction={auction} />
          ))}
        </div>
      )}
    </>
  );
}