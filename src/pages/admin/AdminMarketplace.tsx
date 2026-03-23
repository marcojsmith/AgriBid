import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { AlertCircle } from "lucide-react";

import { BidMonitor } from "@/components/admin/BidMonitor";
import { AdminConnectionError } from "@/components/admin/AdminConnectionError";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

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
  const hasTimedOut = useLoadingTimeout(adminStats === undefined);

  if (adminStats === undefined) {
    return (
      <AdminLayout
        title="Live Auction Monitor"
        subtitle="Real-time Bidding & Activity Stream"
      >
        <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
          {!hasTimedOut ? (
            <>
              <LoadingIndicator size="lg" />
              <p className="text-muted-foreground font-medium animate-pulse">
                Synchronizing live auction feed...
              </p>
            </>
          ) : (
            <AdminConnectionError
              title="Monitor Timeout"
              description="We're having trouble reaching the live monitoring service. This could be due to a temporary network issue or high server load."
            />
          )}
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
        {adminStats.status === "partial" && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 rounded-lg text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            Warning: Background aggregates are currently partial. Global metric
            numbers may be out of sync.
          </div>
        )}
        <div className="w-full">
          <BidMonitor />
        </div>
      </div>
    </AdminLayout>
  );
}
