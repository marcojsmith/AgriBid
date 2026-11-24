import { useAuth, SignIn } from "@clerk/clerk-react";
import { Navigate, useSearchParams } from "react-router-dom";

import { ContinuingTo } from "@/components/auth/ContinuingTo";
import { LoadingPage } from "@/components/LoadingIndicator";
import { safeCallbackPath } from "@/lib/registrationCopy";

/**
 * Sign-in page (`/login`, design `register-r2`): "Continuing to Lot 3 · New
 * Holland T6070" when the buyer came from a lot, then Clerk's embedded
 * sign-in form styled by `clerkAppearance`. "Create an account" goes to
 * `/sign-up`, keeping the `callbackUrl`.
 *
 * Shows a loading indicator while Clerk initialises and sends an already
 * signed-in user straight to the (validated) callback URL.
 *
 * @returns The sign-in page
 */
export default function Login() {
  const { isSignedIn, isLoaded } = useAuth();
  const [searchParams] = useSearchParams();

  const callback = safeCallbackPath(searchParams.get("callbackUrl"));
  const callbackURL = callback ?? "/";
  const query = callback ? `?callbackUrl=${encodeURIComponent(callback)}` : "";

  if (!isLoaded) {
    return <LoadingPage message="Authenticating..." />;
  }

  if (isSignedIn) {
    return <Navigate to={callbackURL} replace />;
  }

  return (
    <div className="mx-auto mt-4 mb-16 flex w-full max-w-[480px] flex-col gap-4 px-4 sm:mt-10">
      <ContinuingTo callbackUrl={callback} />
      <SignIn
        routing="hash"
        fallbackRedirectUrl={callbackURL}
        signUpUrl={`/sign-up${query}`}
        signUpForceRedirectUrl={`/register${query}`}
      />
    </div>
  );
}
