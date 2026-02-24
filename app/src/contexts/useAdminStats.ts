import { useContext } from "react";
import { AdminStatsContext, NO_PROVIDER } from "./admin-stats-types";

/**
 * Accesses the current admin statistics from the AdminStatsContext.
 *
 * @returns The `AdminStats` object from context, `null` when explicitly no statistics are available, or `undefined` while loading.
 * @throws Error If called outside an `AdminStatsProvider`.
 */
export function useAdminStats() {
  const context = useContext(AdminStatsContext);
  if (context === NO_PROVIDER) {
    throw new Error("useAdminStats must be used within an AdminStatsProvider");
  }
  return context;
}
