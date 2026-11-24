import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { SupportTab } from "@/components/admin/SupportTab";
import { TransportQuotesTab } from "@/components/admin/TransportQuotesTab";
import { SegmentedControl } from "@/components/ds/SegmentedControl";

/**
 * Render the Admin "Support Tickets" page, with a switch between support
 * tickets and transport quote requests, and show a centred loading indicator while admin statistics are loading.
 *
 * @returns The Admin Support page React element; displays a centred LoadingIndicator when stats are undefined and the SupportTab once stats are available.
 */
export default function AdminSupport() {
  const adminStats = useQuery(api.admin.getAdminStats);
  const [view, setView] = useState<"tickets" | "transport">("tickets");

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
      <SegmentedControl
        ariaLabel="Support view"
        className="mb-4"
        value={view}
        onChange={setView}
        options={[
          { value: "tickets", label: "Tickets" },
          { value: "transport", label: "Transport quotes" },
        ]}
      />
      {view === "tickets" ? <SupportTab /> : <TransportQuotesTab />}
    </AdminLayout>
  );
}
