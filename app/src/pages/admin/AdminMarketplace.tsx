import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { BidMonitor } from "@/components/admin";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";

export default function AdminMarketplace() {
  const adminStats = useQuery(api.admin.getAdminStats);

  if (adminStats === undefined) {
    return (
      <AdminLayout
        stats={null}
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
      stats={adminStats}
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
