// app/src/pages/Login.tsx
import { useSession, signIn, signUp } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";

/**
 * Render a dedicated Login/Registration page.
 * Handles authentication redirects via the 'callbackUrl' search parameter.
 * 
 * @returns The Login page JSX element
 */
export default function Login() {
  const { data: session, isPending } = useSession();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  const callbackURL = searchParams.get("callbackUrl") || "/";

  // If already logged in, redirect to the callback URL
  if (session) {
    return <Navigate to={callbackURL} replace />;
  }

  if (isPending) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-background text-primary animate-pulse font-bold">
        AGRIBID AUTHENTICATING...
      </div>
    );
  }

  return (
    <div id="auth-form" className="max-w-md mx-auto mt-12 mb-20 space-y-8 border-2 border-primary/20 p-8 rounded-2xl bg-card shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-black text-primary mb-2 uppercase tracking-tight">AgriBid Access</h2>
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
              const { error } = await signIn.email({ 
                email, 
                password,
                callbackURL
              });
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
              const name = emailPrefix
                .replace(/^[0-9._-]+|[0-9._-]+$/g, '')
                .replace(/^[a-z]/, (char) => char.toUpperCase()) || "User";
              
              const { error } = await signUp.email({ 
                email, 
                password, 
                name,
                callbackURL
              });
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
          <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-lg text-sm font-bold">
            {authError}
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="email" className="text-xs font-black uppercase text-muted-foreground ml-1 tracking-wider">Email Address</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@farm.com"
            className="h-12 border-2 rounded-xl focus-visible:ring-primary"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-xs font-black uppercase text-muted-foreground ml-1 tracking-wider">
            {authMode === "signin" ? "Secure Password" : "Create Secure Password"}
          </label>
          <Input
            id="password"
            type="password"
            autoComplete={authMode === "signin" ? "current-password" : "new-password"}
            placeholder="••••••••"
            className="h-12 border-2 rounded-xl focus-visible:ring-primary"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="h-14 text-lg font-black uppercase tracking-tight rounded-xl shadow-lg shadow-primary/20 mt-2" disabled={signInLoading || signUpLoading}>
          {authMode === "signin" 
            ? (signInLoading ? "Signing in..." : "Sign In to AgriBid") 
            : (signUpLoading ? "Creating account..." : "Create Verified Account")}
        </Button>
        
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-muted-foreground/20"></span></div>
          <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
            <span className="bg-card px-4 text-muted-foreground">
              {authMode === "signin" ? "New to the platform?" : "Already have an account?"}
            </span>
          </div>
        </div>
        
        <Button 
          type="button" 
          variant="outline" 
          className="h-12 font-bold rounded-xl border-2 uppercase text-xs tracking-widest" 
          onClick={() => {
            setAuthMode(authMode === "signin" ? "signup" : "signin");
            setAuthError("");
          }}
        >
          {authMode === "signin" ? "Switch to Registration" : "Switch to Sign In"}
        </Button>
      </form>
    </div>
  );
}
