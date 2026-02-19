// app/src/pages/admin/tabs/ModerationTab.tsx
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { ModerationCard, EmptyState, BidMonitor } from "@/components/admin";
import { useAdminDashboard } from "../context/useAdminDashboard";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";

export function ModerationTab() {
  const { pendingAuctions, approveAuction, rejectAuction } = useAdminDashboard();
  const navigate = useNavigate();

  if (pendingAuctions === undefined) {
    return (
      <TabsContent value="moderation" className="h-64 flex items-center justify-center">
        <LoadingIndicator />
      </TabsContent>
    );
  }

  return (
    <TabsContent
      value="moderation"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight">
              Pending Review
            </h2>
            <Badge variant="outline">{pendingAuctions?.length || 0}</Badge>
          </div>
          {pendingAuctions?.map((auction) => (
            <ModerationCard
              key={auction._id}
              auction={auction}
              onApprove={async () => {
                try {
                  await approveAuction(auction._id);
                  toast.success("Approved");
                } catch (err) {
                  console.error(`approveAuction failed for ${auction._id}:`, err);
                  toast.error("Error approving");
                }
              }}
              onReject={async () => {
                try {
                  await rejectAuction(auction._id);
                  toast.success("Rejected");
                } catch (err) {
                  console.error(`rejectAuction failed for ${auction._id}:`, err);
                  toast.error("Error rejecting");
                }
              }}
              onView={() => navigate(`/auction/${auction._id}`)}
            />
          ))}
          {pendingAuctions?.length === 0 && (
            <EmptyState label="Queue is Clear" icon={<Check />} />
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight">
              Live Auction Monitor
            </h2>
            <Badge
              variant="outline"
              className="animate-pulse bg-green-500/10 text-green-600 border-green-500/20"
            >
              Active
            </Badge>
          </div>
          <BidMonitor />
        </div>
      </div>
    </TabsContent>
  );
}
