import type { ReactNode } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { AdminStatsContext } from "../hooks/useAdminStats";

export { AdminStatsContext };

/**
 * Provide admin statistics to descendant components via AdminStatsContext.
 *
 * @param props - Component props
 * @param props.children - React nodes rendered inside the provider
 * @returns A React element that supplies the fetched admin statistics as the context value
 */
export function AdminStatsProvider({ children }: { children: ReactNode }) {
  const stats = useQuery(api.admin.getAdminStats);

  return (
    <AdminStatsContext.Provider value={stats}>
      {children}
    </AdminStatsContext.Provider>
  );
}
