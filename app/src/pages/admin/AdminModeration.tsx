import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Check } from "lucide-react";
import { ModerationCard } from "@/components/admin";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { AdminLayout } from "@/components/admin/AdminLayout";
import type { Id } from "convex/_generated/dataModel";

export default function AdminModeration() {
  const pendingAuctions = useQuery(api.auctions.getPendingAuctions);
  const adminStats = useQuery(api.admin.getAdminStats);
  const approveAuctionMutation = useMutation(api.auctions.approveAuction);
  const rejectAuctionMutation = useMutation(api.auctions.rejectAuction);
  const navigate = useNavigate();

  const handleApprove = async (id: Id<"auctions">) => {
    try {
      await approveAuctionMutation({ auctionId: id });
      toast.success("Auction approved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve auction");
    }
  };

  const handleReject = async (id: Id<"auctions">) => {
    try {
      await rejectAuctionMutation({ auctionId: id });
      toast.success("Auction rejected");
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject auction");
    }
  };

  if (pendingAuctions === undefined) {
    return (
      <AdminLayout
        stats={adminStats || null}
        title="Moderation Queue"
        subtitle="Review & Approve Pending Listings"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      stats={adminStats || null}
      title="Moderation Queue"
      subtitle="Review & Approve Pending Listings"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingAuctions.map((auction) => (
            <ModerationCard
              key={auction._id}
              auction={auction}
              onApprove={() => handleApprove(auction._id)}
              onReject={() => handleReject(auction._id)}
              onView={() => navigate(`/auction/${auction._id}`)}
            />
          ))}
        </div>

        {pendingAuctions.length === 0 && (
          <div className="py-20 bg-muted/30 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center px-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Check className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-tight">
              Queue is Clear
            </h3>
            <p className="text-muted-foreground text-sm max-w-[250px] mt-1">
              All pending auctions have been reviewed. Good work!
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
