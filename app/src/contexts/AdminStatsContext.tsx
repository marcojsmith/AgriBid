import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface AdminStats {
  totalAuctions: number;
  activeAuctions: number;
  pendingReview: number;
  totalUsers: number;
  verifiedSellers: number;
}

const AdminStatsContext = createContext<AdminStats | undefined | null>(undefined);

/**
 * Provides admin statistics to descendant components via React context.
 *
 * @param children - The React nodes to render inside the provider
 * @returns A React element that wraps `children` with `AdminStatsContext.Provider`, supplying fetched admin statistics as the context value
 */
export function AdminStatsProvider({ children }: { children: ReactNode }) {
  const stats = useQuery(api.admin.getAdminStats);

  return (
    <AdminStatsContext.Provider value={stats}>
      {children}
    </AdminStatsContext.Provider>
  );
}

/**
 * Accesses the current admin statistics from the AdminStatsContext.
 *
 * @returns The `AdminStats` object from context, `undefined` if the hook is used outside the provider or the context value has not been set, or `null` if there are explicitly no statistics available.
 */
export function useAdminStats() {
  const context = useContext(AdminStatsContext);
  // Optional: throw if undefined to ensure usage within provider
  // if (context === undefined) {
  //   throw new Error("useAdminStats must be used within an AdminStatsProvider");
  // }
  return context;
}