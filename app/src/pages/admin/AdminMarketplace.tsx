import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { BidMonitor } from "@/components/admin";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";

/**
 * Admin page that shows a live auction monitor and current admin interface.
 *
 * While admin statistics are loading it displays a centred loading indicator;
 * once data is available it renders the live BidMonitor inside the admin layout.
 *
 * @returns A React element containing the admin layout with either a loading indicator or the live BidMonitor
 */
export default function AdminMarketplace() {
  const adminStats = useQuery(api.admin.getAdminStats);

  if (adminStats === undefined) {
    return (
      <AdminLayout
        title="Live Auction Monitor"
        subtitle="Real-time Bidding & Activity Stream"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Live Auction Monitor"
      subtitle="Real-time Bidding & Activity Stream"
    >
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="w-full">
          <BidMonitor />
        </div>
      </div>
    </AdminLayout>
  );
}