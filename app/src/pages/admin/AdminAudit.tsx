import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { AuditTab } from "@/components/admin/AuditTab";

/**
 * Render the System Audit Logs admin page.
 *
 * Displays a centred loading indicator while admin statistics are being fetched,
 * and renders the audit interface with retrieved statistics once available.
 *
 * @returns The AdminAudit page as a JSX element
 */
export default function AdminAudit() {
  const adminStats = useQuery(api.admin.getAdminStats);

  if (adminStats === undefined) {
    return (
      <AdminLayout
        stats={null}
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
      stats={adminStats}
      title="System Audit Logs"
      subtitle="Security, Access & Administrative Actions"
    >
      <AuditTab />
    </AdminLayout>
  );
}