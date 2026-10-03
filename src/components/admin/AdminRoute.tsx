import { Outlet } from "react-router-dom";

import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminStatsProvider } from "@/contexts/AdminStatsContext";

/**
 * Wrapper component for admin routes that provides:
 * - Role-based access control (admin role required)
 * - AdminLayout with sidebar navigation and KPI header
 * - AdminStatsProvider for admin statistics context
 * - RouteErrorBoundary for per-route error isolation
 *
 * This component ensures the AdminLayout and its providers are mounted once
 * and remain mounted across navigations between child admin routes, preventing
 * unnecessary remounting of AdminStatsProvider and state loss.
 *
 * @returns A React element wrapping the child route outlet
 */
export function AdminRoute() {
  return (
    <RoleProtectedRoute allowedRole="admin">
      <RouteErrorBoundary>
        <AdminStatsProvider>
          <AdminLayout>
            <Outlet />
          </AdminLayout>
        </AdminStatsProvider>
      </RouteErrorBoundary>
    </RoleProtectedRoute>
  );
}
