// app/src/pages/admin/context/useAdminDashboard.ts
import { useContext } from "react";
import { AdminDashboardContext } from "./AdminDashboardContext";

/**
 * Custom hook to consume the AdminDashboardContext.
 *
 * @returns The AdminDashboardContextType value
 * @throws Error if used outside of AdminDashboardProvider
 */
export function useAdminDashboard() {
  const context = useContext(AdminDashboardContext);
  if (context === undefined) {
    throw new Error("useAdminDashboard must be used within an AdminDashboardProvider");
  }
  return context;
}
