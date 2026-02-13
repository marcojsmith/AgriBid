// app/src/pages/Sell.tsx
import { Authenticated, Unauthenticated } from "convex/react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function Sell() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Authenticated>
        <header className="border-b bg-card px-8 py-4 flex justify-between items-center sticky top-0 z-50">
          <Link to="/" className="text-2xl font-black tracking-tighter text-primary">AGRIBID</Link>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Marketplace
          </Button>
        </header>

        <main className="container mx-auto p-8 max-w-4xl">
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-primary uppercase">List Your Equipment</h1>
              <p className="text-muted-foreground mt-2">Complete the steps below to put your machinery in front of thousands of verified buyers.</p>
            </div>

            {/* Wizard Placeholder */}
            <div className="bg-card border-2 border-dashed border-primary/20 rounded-2xl p-20 flex flex-col items-center justify-center text-center">
              <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-6">
                <span className="text-4xl">🚜</span>
              </div>
              <h2 className="text-2xl font-bold">Listing Wizard Coming Soon</h2>
              <p className="text-muted-foreground max-w-md mt-2">
                We're currently building our high-integrity inspection flow to ensure the best value for your machinery.
              </p>
              <Button className="mt-8 px-8 font-black" onClick={() => navigate("/")}>
                Return to Home
              </Button>
            </div>
          </div>
        </main>
      </Authenticated>

      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-[80vh] space-y-6 px-4 text-center">
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Authentication Required</h1>
          <p className="text-muted-foreground max-w-sm">Please sign in or create an account to list your equipment on AgriBid.</p>
          <Button asChild className="px-8 font-bold">
            <Link to="/">Go to Login</Link>
          </Button>
        </div>
      </Unauthenticated>
    </div>
  );
}
