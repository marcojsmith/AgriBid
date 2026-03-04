import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "./ui/button";
import { isValidCallbackUrl } from "@/lib/utils";
import { LoadingPage } from "@/components/LoadingIndicator";
import { AdminConnectionError } from "./admin/AdminConnectionError";

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRole: string;
}

/**
 * The duration in milliseconds to wait for the user profile query to resolve before showing an error.
 */
const PROFILE_LOAD_TIMEOUT = 15000; // 15 seconds

export const RoleProtectedRoute = ({
  children,
  allowedRole,
}: RoleProtectedRouteProps) => {
  const { data: session, isPending: isAuthPending } = useSession();
  const userData = useQuery(api.users.getMyProfile);
  const syncUser = useMutation(api.users.syncUser);
  const location = useLocation();
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Manually triggers a profile synchronization when loading has timed out.
   * Resets the timeout state to show the loading indicator, and invokes the syncUser mutation.
   * If the mutation fails, it logs the error and immediately sets the timeout state back to true for instant feedback.
   */
  const handleRetry = useCallback(async () => {
    setHasTimedOut(false);
    try {
      const result = await syncUser();
      if (!result?.success) {
        console.error("Manual profile sync returned an unsuccessful result.");
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        setHasTimedOut(true);
      }
    } catch (err) {
      console.error("Manual profile sync failed:", err);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setHasTimedOut(true);
    }
  }, [syncUser]);

  /**
   * Starts a timeout to show an error if the user profile doesn't load within PROFILE_LOAD_TIMEOUT.
   * Only runs when a session exists but userData is null or undefined.
   * The timer is cleared on cleanup to prevent memory leaks.
   * hasTimedOut is only reset manually via handleRetry.
   */
  useEffect(() => {
    if (
      session &&
      (userData === null || userData === undefined) &&
      !hasTimedOut
    ) {
      timerRef.current = setTimeout(() => {
        setHasTimedOut(true);
      }, PROFILE_LOAD_TIMEOUT);
    }

    // Note: We don't reset hasTimedOut here when userData becomes non-null
    // because the component will either render its children or a different
    // loading state, and hasTimedOut being true doesn't affect that.
    // It is reset in handleRetry.

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [session, userData, hasTimedOut]);

  const isPending =
    isAuthPending || (session && userData === undefined && !hasTimedOut);

  if (isPending) {
    return <LoadingPage message="Verifying permissions..." />;
  }

  if (!session) {
    const rawUrl = `${location.pathname}${location.search}${location.hash}`;
    const callbackUrl = isValidCallbackUrl(rawUrl)
      ? encodeURIComponent(rawUrl)
      : "/";
    return <Navigate to={`/login?callbackUrl=${callbackUrl}`} replace />;
  }

  // If session exists but userData is null or undefined and has timed out
  // it might be a race condition with the profile creation (syncUser) in Layout.tsx
  // or a failed query.
  if (userData === null || (userData === undefined && hasTimedOut)) {
    if (hasTimedOut) {
      return (
        <div className="flex flex-col h-[80vh] items-center justify-center p-6">
          <AdminConnectionError
            title="Profile Loading Error"
            description="We're having trouble synchronizing your application profile. This can happen during your first login or due to a temporary connection issue."
            onRetry={handleRetry}
          />
        </div>
      );
    }
    return <LoadingPage message="Initializing your profile..." />;
  }

  const userRole = userData?.profile?.role;
  if (allowedRole !== "any" && userRole !== allowedRole) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center space-y-4">
        <h1 className="text-2xl font-bold uppercase">Access Denied</h1>
        <p className="text-muted-foreground font-medium">
          You do not have the required permissions to view this page.
        </p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
