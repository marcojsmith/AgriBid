import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { SupportTab } from "@/components/admin/SupportTab";

/**
 * Render the Admin "Support Tickets" page and show a centred loading indicator while admin statistics are loading.
 *
 * @returns The Admin Support page React element; displays a centred LoadingIndicator when stats are undefined and the SupportTab once stats are available.
 */
export default function AdminSupport() {
  const adminStats = useQuery(api.admin.getAdminStats);

  if (adminStats === undefined) {
    return (
      <AdminLayout
        title="Support Tickets"
        subtitle="Customer Service & Issue Resolution"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Support Tickets"
      subtitle="Customer Service & Issue Resolution"
    >
      <SupportTab />
    </AdminLayout>
  );
}
