import { useAuth, SignIn } from "@clerk/clerk-react";
import { Navigate, useSearchParams } from "react-router-dom";

import { useBranding } from "@/hooks/useBranding";
import { isValidCallbackUrl } from "@/lib/utils";
import { LoadingPage } from "@/components/LoadingIndicator";

/**
 * Login page rendering Clerk's embedded <SignIn> component.
 *
 * Shows a loading indicator while Clerk auth is initialising, redirects
 * already-authenticated users to the (validated) callback URL, and renders
 * the sign-in flow for everyone else.
 *
 * @returns The login page JSX element.
 */
export default function Login() {
  const branding = useBranding();
  const { isSignedIn, isLoaded } = useAuth();
  const [searchParams] = useSearchParams();

  const rawCallback = searchParams.get("callbackUrl");
  const callbackURL = isValidCallbackUrl(rawCallback) ? rawCallback : "/";

  if (!isLoaded) {
    return <LoadingPage message="Authenticating..." />;
  }

  if (isSignedIn) {
    return <Navigate to={callbackURL} replace />;
  }

  return (
    <div className="flex flex-col items-center mt-12 mb-20 space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-black text-primary mb-2 uppercase tracking-tight">
          {branding?.appName ?? "AgriBid"} Access
        </h2>
        <p className="text-muted-foreground text-sm uppercase tracking-widest">
          Real-Time Bidding for Serious Farmers
        </p>
      </div>
      <SignIn
        routing="hash"
        afterSignInUrl={callbackURL}
        afterSignUpUrl={callbackURL}
      />
    </div>
  );
}
