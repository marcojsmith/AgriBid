// app/src/pages/Profile.tsx
import { useParams, Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { UserCheck, ShieldCheck, Calendar, Gavel, Award, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuctionCard } from "@/components/AuctionCard";

export default function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const profile = useQuery(api.auctions.getPublicProfile, { userId: userId || "" });

  if (profile === undefined) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-6">
        <h1 className="text-4xl font-black uppercase">User Not Found</h1>
        <p className="text-muted-foreground font-bold">The profile you are looking for does not exist or has been deactivated.</p>
        <Button asChild variant="outline" className="rounded-xl border-2">
          <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace</Link>
        </Button>
      </div>
    );
  }

  const { user, listings } = profile;
  const memberSince = new Date(user.createdAt).getFullYear();
  const activeListings = listings.filter(l => l.status === 'active');
  const soldListings = listings.filter(l => l.status === 'sold');

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      {/* Profile Header */}
      <div className="bg-card border-4 border-primary/10 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl shadow-primary/5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
          <div className="h-32 w-32 rounded-[2rem] bg-primary/10 flex items-center justify-center border-4 border-primary/5 shadow-inner">
            <UserCheck className="h-16 w-16 text-primary" />
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="space-y-1">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-primary uppercase leading-none">
                  {user.name}
                </h1>
                {user.isVerified && (
                  <Badge className="bg-green-600 hover:bg-green-700 font-black uppercase tracking-widest px-3 py-1 flex items-center gap-1.5 h-8">
                    <ShieldCheck className="h-4 w-4" />
                    Verified Seller
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-sm text-muted-foreground font-bold uppercase tracking-wide">
                <span className="bg-primary/5 text-primary px-3 py-1 rounded-lg border border-primary/10">{user.role}</span>
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Joined {memberSince}</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-6 pt-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center">
                  <Gavel className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-black leading-none">{activeListings.length}</p>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Ads</p>
                </div>
              </div>
              <div className="flex items-center gap-3 border-l-2 border-primary/10 pl-6">
                <div className="h-10 w-10 rounded-xl bg-green-500/5 flex items-center justify-center">
                  <Award className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-black leading-none">{soldListings.length}</p>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Items Sold</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Listings Section */}
      <section className="space-y-8">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Gavel className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Active Auctions</h2>
        </div>

        {activeListings.length === 0 ? (
          <div className="bg-muted/20 border-2 border-dashed rounded-[2rem] p-16 text-center">
            <p className="text-muted-foreground font-bold uppercase tracking-widest italic">No active auctions at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeListings.map((auction) => (
              <AuctionCard key={auction._id} auction={auction} />
            ))}
          </div>
        )}
      </section>

      {/* Sold History Section */}
      {soldListings.length > 0 && (
        <section className="space-y-8 opacity-80">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Award className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-3xl font-black tracking-tight text-green-700 uppercase">Sales History</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {soldListings.map((auction) => (
              <AuctionCard key={auction._id} auction={auction} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
