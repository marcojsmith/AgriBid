import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "./ui/button";
import { isValidCallbackUrl } from "@/lib/utils";

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRole: string;
}

export const RoleProtectedRoute = ({
  children,
  allowedRole,
}: RoleProtectedRouteProps) => {
  const { data: session, isPending: isAuthPending } = useSession();
  const userData = useQuery(api.users.getMyProfile);
  const location = useLocation();

  const isPending = isAuthPending || (session && userData === undefined);

  if (isPending) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-background text-primary animate-pulse font-bold">
        VERIFYING PERMISSIONS...
      </div>
    );
  }

  if (!session) {
    const rawUrl = `${location.pathname}${location.search}${location.hash}`;
    const callbackUrl = isValidCallbackUrl(rawUrl)
      ? encodeURIComponent(rawUrl)
      : "/";
    return <Navigate to={`/login?callbackUrl=${callbackUrl}`} replace />;
  }

  if (session && userData === null) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center space-y-4">
        <h1 className="text-2xl font-bold uppercase text-destructive">
          Access Error
        </h1>
        <p className="text-muted-foreground font-medium">
          Failed to load your profile. Please try refreshing the page.
        </p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
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
