import { useAuth, SignUp as ClerkSignUp } from "@clerk/clerk-react";
import { Navigate, useSearchParams } from "react-router-dom";

import { ContinuingTo } from "@/components/auth/ContinuingTo";
import { LoadingPage } from "@/components/LoadingIndicator";
import { safeCallbackPath } from "@/lib/registrationCopy";

/**
 * Sign-up page (`/sign-up`, design `register-r2`): "Continuing to Lot 3 · New
 * Holland T6070" when the buyer came from a lot, then Clerk's embedded
 * sign-up form. Once the account exists the buyer goes to
 * `/register?callbackUrl=…`, where the registration steps ask for their ID
 * details and then return them to the lot. "Sign in" goes to `/login`,
 * keeping the `callbackUrl`.
 *
 * @returns The sign-up page
 */
export default function SignUp() {
  const { isSignedIn, isLoaded } = useAuth();
  const [searchParams] = useSearchParams();

  const callback = safeCallbackPath(searchParams.get("callbackUrl"));
  const query = callback ? `?callbackUrl=${encodeURIComponent(callback)}` : "";
  const registerTarget = `/register${query}`;

  if (!isLoaded) {
    return <LoadingPage message="Authenticating..." />;
  }

  if (isSignedIn) {
    return <Navigate to={registerTarget} replace />;
  }

  return (
    <div className="mx-auto mt-4 mb-16 flex w-full max-w-[480px] flex-col gap-4 px-4 sm:mt-10">
      <ContinuingTo callbackUrl={callback} />
      <ClerkSignUp
        routing="hash"
        forceRedirectUrl={registerTarget}
        signInUrl={`/login${query}`}
        signInFallbackRedirectUrl={callback ?? "/"}
      />
    </div>
  );
}
