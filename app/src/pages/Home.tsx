// app/src/pages/Home.tsx
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { useSession, signIn, signUp } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useState } from "react";
import { api } from "convex/_generated/api";
import { AuctionCard } from "../components/AuctionCard";
import type { Doc } from "convex/_generated/dataModel";
import { Link, useSearchParams } from "react-router-dom";

/**
 * Render the AgriBid home page with conditional authenticated and unauthenticated views.
 *
 * Authenticated users are presented with active auctions, controls to seed mock data and navigate to selling; unauthenticated users see an inline sign-in/sign-up form with validation and loading states. While authentication status is pending, a full-screen loading indicator is shown.
 *
 * @returns The Home page JSX element
 */
export default function Home() {
  const { isPending } = useSession();
  const [searchParams] = useSearchParams();
  const rawQuery = searchParams.get("q") || "";
  const searchQuery = rawQuery.trim() === "" ? undefined : rawQuery.trim();
  
  const auctions = useQuery(api.auctions.getActiveAuctions, { search: searchQuery });
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  if (isPending) {
    return <div className="flex h-[80vh] items-center justify-center bg-background text-primary animate-pulse font-bold">AGRIBID LOADING...</div>;
  }

  return (
    <>
      <Authenticated>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {searchQuery ? `Results for "${searchQuery}"` : "Active Auctions"}
            </h2>
            {searchQuery && (
              <Button 
                variant="link" 
                className="p-0 h-auto text-muted-foreground hover:text-primary"
                asChild
              >
                <Link to="/">Clear search results</Link>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
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
                      <p className="text-muted-foreground mb-4">
                        {searchQuery 
                          ? `No auctions found matching "${searchQuery}".` 
                          : "No active auctions at the moment."}
                      </p>
                      {searchQuery && (
                        <Button asChild>
                          <Link to="/">View All Auctions</Link>
                        </Button>
                      )}
                    </div>
                  ) : (          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  const emailPrefix = email.split('@')[0] || "User";
                  // Clean up prefix (remove numbers/special chars at end, capitalize)
                  const name = emailPrefix
                    .replace(/[0-9._-]+$/, '')
                    .replace(/^[a-z]/, (char) => char.toUpperCase()) || "User";
                  
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
    </>
  );
}