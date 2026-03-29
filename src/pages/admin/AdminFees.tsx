import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { DollarSign, Users, Building2 } from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { FeeManager } from "@/components/admin/FeeManager";
import { StatCard } from "@/components/admin/StatCard";

/**
 * Admin page for managing platform fees and viewing fee statistics.
 * Displays aggregated fee data and provides access to the fee management interface.
 * @returns The AdminFees page component
 */
export default function AdminFees() {
  const feeStats = useQuery(api.admin.getFeeStats);

  if (feeStats === undefined) {
    return (
      <AdminLayout title="Platform Fees" subtitle="Configure Fee Rules & Rates">
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Platform Fees" subtitle="Configure Fee Rules & Rates">
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Total Fees Collected"
            value={`R ${feeStats.totalFeesCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<DollarSign className="h-5 w-5" />}
            color="text-success"
            padding="p-6"
            bgVariant="bg-card/50"
            iconSize="h-12 w-12"
          />
          <StatCard
            label="Buyer Fees"
            value={`R ${feeStats.buyerFeesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<Users className="h-5 w-5" />}
            color="text-primary"
            padding="p-6"
            bgVariant="bg-card/50"
            iconSize="h-12 w-12"
          />
          <StatCard
            label="Seller Fees"
            value={`R ${feeStats.sellerFeesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<Building2 className="h-5 w-5" />}
            color="text-success"
            padding="p-6"
            bgVariant="bg-card/50"
            iconSize="h-12 w-12"
          />
        </div>

        <FeeManager />
      </div>
    </AdminLayout>
  );
}
