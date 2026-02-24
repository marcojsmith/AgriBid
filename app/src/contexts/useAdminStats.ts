 
import { useContext } from "react";
import { AdminStatsContext } from "./admin-stats-types";

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
