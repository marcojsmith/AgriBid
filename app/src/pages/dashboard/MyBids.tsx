// app/src/pages/dashboard/MyBids.tsx
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gavel } from "lucide-react";

export default function MyBids() {
  const auctions = useQuery(api.auctions.getMyBids);

  if (auctions === undefined) {
    return (
      <div className="flex h-[60vh] items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Gavel className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-primary uppercase">My Bids</h1>
      </div>

      {auctions.length === 0 ? (
        <div className="max-w-4xl mx-auto space-y-8 py-24 text-center bg-card border-2 border-dashed rounded-3xl border-primary/10">
          <p className="text-muted-foreground text-lg max-w-md mx-auto font-bold uppercase tracking-widest">
            You haven't placed any bids yet.
          </p>
          <Button size="lg" className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20" asChild>
            <Link to="/">Browse Auctions</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {auctions.map((auction) => {
            const isWinning = auction.isWinning;
            const isWon = auction.isWon;
            const isLost = auction.status === 'sold' && !isWon;

            return (
              <div key={auction._id} className="bg-card border-2 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-video bg-muted relative">
                  {auction.images.front && (
                    <img src={auction.images.front} alt={auction.title} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant={
                      isWon ? "default" : 
                      isWinning ? "default" : 
                      isLost ? "destructive" : 
                      "outline"
                    } className="font-bold uppercase tracking-wider">
                      {isWon ? "WON" : isWinning ? "WINNING" : isLost ? "OUTBID / SOLD" : auction.status}
                    </Badge>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <h3 className="font-bold text-lg leading-tight line-clamp-2">{auction.title}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-black">My Max Bid</p>
                      <p className="font-bold">R {auction.myHighestBid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-black">Current Price</p>
                      <p className="font-bold text-primary">R {auction.currentPrice.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button className="w-full font-bold" variant="outline" asChild>
                    <Link to={`/auction/${auction._id}`}>
                      {auction.status === 'active' ? "View Auction" : "View Results"}
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
