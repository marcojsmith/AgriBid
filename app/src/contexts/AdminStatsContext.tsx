 
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import { AdminStatsContext } from "./admin-stats-types";

export { AdminStatsContext };

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
