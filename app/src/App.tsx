// app/src/App.tsx
import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { useSession, signIn, signUp, signOut } from "./lib/auth-client";
import { Button } from "./components/ui/button";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import { AuctionCard } from "./components/AuctionCard";
import type { Doc } from "../convex/_generated/dataModel";

function App() {
  const { data: session, isPending } = useSession();
  const auctions = useQuery(api.auctions.getActiveAuctions);
  const seedMetadata = useMutation(api.seed.seedEquipmentMetadata);
  const seedAuctions = useMutation(api.seed.seedMockAuctions);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);

  const handleSeed = async () => {
    await seedMetadata();
    await seedAuctions();
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
              <Button size="sm">Sell Equipment</Button>
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
              <p className="text-muted-foreground text-sm uppercase tracking-widest">Real-Time Bidding for Serious Farmers</p>
            </div>
            
            <div className="flex flex-col space-y-4">
              {authError && (
                <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-lg text-sm">
                  {authError}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-bold uppercase text-muted-foreground ml-1">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="name@farm.com"
                  className="w-full border-2 border-muted p-3 rounded-xl focus:border-primary outline-none transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-bold uppercase text-muted-foreground ml-1">Secure Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full border-2 border-muted p-3 rounded-xl focus:border-primary outline-none transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="h-12 text-lg font-bold rounded-xl" disabled={signInLoading} onClick={async () => {
                setSignInLoading(true);
                setAuthError("");
                try {
                  await signIn.email({ email, password });
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Sign in failed. Please try again.";
                  setAuthError(message);
                  console.error("Sign in error:", error);
                } finally {
                  setSignInLoading(false);
                }
              }}>
                {signInLoading ? "Signing in..." : "Sign In to AgriBid"}
              </Button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground font-bold">New to the platform?</span></div>
              </div>
              <Button variant="secondary" className="h-12 font-bold rounded-xl" disabled={signUpLoading} onClick={async () => {
                setSignUpLoading(true);
                setAuthError("");
                try {
                  const name = email.split('@')[0];
                  await signUp.email({ email, password, name });
                } catch (error) {
                  const message = error instanceof Error ? error.message : "Registration failed. Please try again.";
                  setAuthError(message);
                  console.error("Sign up error:", error);
                } finally {
                  setSignUpLoading(false);
                }
              }}>
                {signUpLoading ? "Creating account..." : "Create Verified Account"}
              </Button>
            </div>
          </div>
        </Unauthenticated>
      </main>
    </div>
  );
}

export default App;
