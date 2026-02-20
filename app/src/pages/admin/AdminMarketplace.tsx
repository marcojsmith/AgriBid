import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Hammer } from "lucide-react";
import { BidMonitor } from "@/components/admin";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";

export default function AdminMarketplace() {
  const adminStats = useQuery(api.admin.getAdminStats);

  if (adminStats === undefined) {
    return (
      <AdminLayout stats={null}>
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout stats={adminStats}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <Hammer className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-black uppercase tracking-tight">
              Live Auction Monitor
            </h2>
            <Badge
              variant="outline"
              className="animate-pulse bg-green-500/10 text-green-600 border-green-500/20 ml-2"
            >
              Active Monitoring
            </Badge>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <BidMonitor />
        </div>
      </div>
    </AdminLayout>
  );
}
