// app/src/pages/AdminDashboard.tsx
import { AdminDashboardProvider } from "./admin/context/AdminDashboardProvider";
import { AdminDashboardContent } from "./admin/AdminDashboardContent";

/**
 * Render the Admin Dashboard interface for managing auctions, users, finance, support, audit, and system settings.
 *
 * This component serves as an orchestrator, providing the AdminDashboardContext to its children.
 * The actual UI logic is delegated to AdminDashboardContent.
 *
 * @returns The Admin Dashboard React element
 */
export default function AdminDashboard() {
  return (
    <AdminDashboardProvider>
      <AdminDashboardContent />
    </AdminDashboardProvider>
  );
}
