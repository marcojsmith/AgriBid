// app/src/components/RoleProtectedRoute.tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth-client";

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

  if (!session || user?.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
