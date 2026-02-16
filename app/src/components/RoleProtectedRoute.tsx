// app/src/components/RoleProtectedRoute.tsx
import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { Button } from "./ui/button";

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRole: string;
}

export const RoleProtectedRoute = ({ children, allowedRole }: RoleProtectedRouteProps) => {
  const { data: session, isPending } = useSession();
  const user = session?.user ? (session.user as typeof session.user & { role?: string }) : undefined;

  if (isPending) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-background text-primary animate-pulse font-bold">
        VERIFYING PERMISSIONS...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (user?.role !== allowedRole) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center space-y-4">
        <h1 className="text-2xl font-bold uppercase">Access Denied</h1>
        <p className="text-muted-foreground font-medium">You do not have the required permissions to view this page.</p>
        <Button asChild>
          <Link to="/">Go Home</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};
