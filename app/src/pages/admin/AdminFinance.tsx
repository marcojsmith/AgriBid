import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { FinanceTab } from "@/components/admin/FinanceTab";

export default function AdminFinance() {
  const adminStats = useQuery(api.admin.getAdminStats);

  if (adminStats === undefined) {
    return (
      <AdminLayout
        stats={null}
        title="Financial Oversight"
        subtitle="Revenue, Commissions & Transaction History"
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
      title="Financial Oversight"
      subtitle="Revenue, Commissions & Transaction History"
    >
      <FinanceTab />
    </AdminLayout>
  );
}
