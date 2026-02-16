// app/src/pages/Watchlist.tsx
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Heart } from "lucide-react";

/**
 * Render the Watchlist page. 
 * This page is protected by RoleProtectedRoute which redirects to login if unauthenticated.
 * 
 * @returns The Watchlist page JSX element
 */
export default function Watchlist() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-12 text-center">
      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Heart className="h-10 w-10 text-primary" />
      </div>
      <div className="space-y-3">
        <h1 className="text-4xl font-black tracking-tight text-primary uppercase">My Watchlist</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Keep track of equipment you're interested in. (Watchlist functionality is coming soon).
        </p>
      </div>
      <Button size="lg" className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20" asChild>
        <Link to="/">Explore Marketplace</Link>
      </Button>
    </div>
  );
}
