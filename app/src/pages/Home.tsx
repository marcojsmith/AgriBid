// app/src/pages/Home.tsx
import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { useSession, signIn, signUp, signOut } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { AuctionCard } from "../components/AuctionCard";
import type { Doc } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Link } from "react-router-dom";

/**
 * Render the Home page for the AgriBid auction platform.
 *
 * Displays a sticky navbar and either an authenticated view (active auctions,
 * seed/mock-data actions, and sign-out) or an unauthenticated view (in-page
 * sign-in / sign-up form with error and loading states). While authentication
 * status is pending, shows a full-screen loading indicator.
 *
 * @returns The JSX element for the Home page, including navbar, auction list, seeding actions, and authentication form.
 */
export default function Home() {
  const { data: session, isPending } = useSession();
  const auctions = useQuery(api.auctions.getActiveAuctions);
  const seedMetadata = useMutation(api.seed.seedEquipmentMetadata);
  const seedAuctions = useMutation(api.seed.seedMockAuctions);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const handleSeed = async () => {
    try {
      await seedMetadata();
      await seedAuctions();
      toast.success("Mock data populated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to populate mock data");
    }
  };

  if (isPending) {
    return <div className="flex h-screen items-center justify-center bg-background text-primary animate-pulse font-bold">AGRIBID LOADING...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="border-b bg-card px-8 py-4 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-2xl font-black tracking-tighter text-primary">AGRIBID</h1>
        <div className="flex items-center gap-4">
          <Authenticated>
            <span className="text-sm font-medium hidden md:inline">Logged in as <span className="text-primary">{session?.user?.name}</span></span>
            <Button variant="outline" size="sm" onClick={async () => await signOut()}>Sign Out</Button>
          </Authenticated>
          <Unauthenticated>
            <Button size="sm" onClick={() => {
              const element = document.getElementById("auth-form");
              if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}>Login / Register</Button>
          </Unauthenticated>
        </div>
      </header>

      <main className="container mx-auto p-8">
        <Authenticated>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Active Auctions</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSeed}>
                Seed Mock Data
              </Button>
              <Button size="sm" asChild>
                <Link to="/sell">Sell Equipment</Link>
              </Button>
            </div>
          </div>

          {!auctions ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : auctions.length === 0 ? (
            <div className="text-center py-20 bg-muted/30 rounded-xl border-2 border-dashed">
              <p className="text-muted-foreground mb-4">No active auctions at the moment.</p>
              <Button onClick={handleSeed}>Populate Mock Auctions</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {auctions.map((auction: Doc<"auctions">) => (
                <AuctionCard key={auction._id} auction={auction} />
              ))}
            </div>
          )}
        </Authenticated>

        <Unauthenticated>
          <div id="auth-form" className="max-w-md mx-auto mt-20 space-y-8 border-2 border-primary/20 p-8 rounded-2xl bg-card shadow-xl">
            <div className="text-center">
              <h2 className="text-3xl font-black text-primary mb-2">FIELD TO MARKET</h2>
              <p className="text-muted-foreground text-sm uppercase tracking-widest">
                {authMode === "signin" ? "Real-Time Bidding for Serious Farmers" : "Join the Leading Agricultural Marketplace"}
              </p>
            </div>
            
            <form 
              className="flex flex-col space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (authMode === "signin") {
                  setSignInLoading(true);
                  setAuthError("");
                  try {
                    const { error } = await signIn.email({ email, password });
                    if (error) {
                      setAuthError(error.message || "Sign in failed");
                    }
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Sign in failed. Please try again.";
                    setAuthError(message);
                    console.error("Sign in error:", error);
                  } finally {
                    setSignInLoading(false);
                  }
                } else {
                  setSignUpLoading(true);
                  setAuthError("");
                  try {
                    const name = email.split('@')[0] || "User";
                    const { error } = await signUp.email({ email, password, name });
                    if (error) {
                      setAuthError(error.message || "Registration failed");
                    }
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Registration failed. Please try again.";
                    setAuthError(message);
                    console.error("Sign up error:", error);
                  } finally {
                    setSignUpLoading(false);
                  }
                }
              }}
            >
              {authError && (
                <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-lg text-sm">
                  {authError}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-bold uppercase text-muted-foreground ml-1">Email Address</label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@farm.com"
                  className="h-12 border-2 rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-bold uppercase text-muted-foreground ml-1">
                  {authMode === "signin" ? "Secure Password" : "Create Secure Password"}
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  className="h-12 border-2 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="h-12 text-lg font-bold rounded-xl" disabled={signInLoading || signUpLoading}>
                {authMode === "signin" 
                  ? (signInLoading ? "Signing in..." : "Sign In to AgriBid") 
                  : (signUpLoading ? "Creating account..." : "Create Verified Account")}
              </Button>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-bold">
                    {authMode === "signin" ? "New to the platform?" : "Already have an account?"}
                  </span>
                </div>
              </div>
              
              <Button 
                type="button" 
                variant="secondary" 
                className="h-12 font-bold rounded-xl" 
                onClick={() => {
                  setAuthMode(authMode === "signin" ? "signup" : "signin");
                  setAuthError("");
                }}
              >
                {authMode === "signin" ? "Switch to Registration" : "Switch to Sign In"}
              </Button>
            </form>
          </div>
        </Unauthenticated>
      </main>
    </div>
  );
}