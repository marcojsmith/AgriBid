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

export function AdminStatsProvider({ children }: { children: ReactNode }) {
  const stats = useQuery(api.admin.getAdminStats);

  return (
    <AdminStatsContext.Provider value={stats}>
      {children}
    </AdminStatsContext.Provider>
  );
}

export function useAdminStats() {
  const context = useContext(AdminStatsContext);
  // Optional: throw if undefined to ensure usage within provider
  // if (context === undefined) {
  //   throw new Error("useAdminStats must be used within an AdminStatsProvider");
  // }
  return context;
}
