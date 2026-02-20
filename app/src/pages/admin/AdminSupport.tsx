import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { SupportTab } from "@/components/admin/SupportTab";

/**
 * Render the admin "Support Tickets" page, displaying a loading indicator until admin statistics are available.
 *
 * @returns The page's React element: an AdminLayout populated with `null` stats and a centred LoadingIndicator while stats are undefined, and with `adminStats` and the SupportTab once data is available.
 */
export default function AdminSupport() {
  const adminStats = useQuery(api.admin.getAdminStats);

  if (adminStats === undefined) {
    return (
      <AdminLayout
        stats={null}
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
      stats={adminStats}
      title="Support Tickets"
      subtitle="Customer Service & Issue Resolution"
    >
      <SupportTab />
    </AdminLayout>
  );
}