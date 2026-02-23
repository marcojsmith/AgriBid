import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { AuditTab } from "@/components/admin/AuditTab";

/**
 * Renders the System Audit Logs admin page.
 *
 * Displays a centred loading indicator while admin statistics are being fetched and renders the audit interface once statistics are available.
 *
 * @returns The page's JSX element
 */
export default function AdminAudit() {
  const adminStats = useQuery(api.admin.getAdminStats);

  if (adminStats === undefined) {
    return (
      <AdminLayout
        title="System Audit Logs"
        subtitle="Security, Access & Administrative Actions"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="System Audit Logs"
      subtitle="Security, Access & Administrative Actions"
    >
      <AuditTab />
    </AdminLayout>
  );
}