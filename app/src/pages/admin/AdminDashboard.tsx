import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  ShieldCheck,
  Hammer,
  Users,
  Megaphone,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Activity,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SummaryCard } from "@/components/admin/SummaryCard";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { formatCurrency } from "@/lib/currency";

/**
 * Render the admin dashboard layout with summary cards for each management area.
 *
 * @returns The admin overview layout populated with real-time, auctions, moderation, users, financials, support, communication and system summary cards.
 */
export default function AdminDashboard() {
  const adminStats = useQuery(api.admin.getAdminStats);
  const financialStats = useQuery(api.admin.getFinancialStats);
  const announcementStats = useQuery(api.admin.getAnnouncementStats);
  const supportStats = useQuery(api.admin.getSupportStats);

  const isLoading =
    adminStats === undefined ||
    financialStats === undefined ||
    announcementStats === undefined ||
    supportStats === undefined;

  if (isLoading) {
    return (
      <AdminLayout
        stats={adminStats || null}
        title="Admin Overview"
        subtitle="Marketplace Control Centre"
      >
        <div className="h-96 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      stats={adminStats || null}
      title="Admin Overview"
      subtitle="Marketplace Control Centre"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Activity Card (Placeholder for now) */}
        <SummaryCard
          title="Real-Time"
          icon={<Activity className="h-5 w-5" />}
          stats={[
            { label: "Live Bidders", value: "—" },
            { label: "Active Watch", value: "—" },
          ]}
          link="/admin/marketplace"
          linkLabel="Open Monitor"
        />

        {/* Auctions Card */}
        <SummaryCard
          title="Auctions"
          icon={<Hammer className="h-5 w-5" />}
          stats={[
            {
              label: "Active Live",
              value: adminStats.activeAuctions,
              color: "text-primary",
            },
            { label: "Total Created", value: adminStats.totalAuctions },
          ]}
          link="/admin/auctions"
          linkLabel="Manage Inventory"
        />

        {/* Moderation Card */}
        <SummaryCard
          title="Moderation"
          icon={<ShieldCheck className="h-5 w-5" />}
          stats={[
            {
              label: "Auctions",
              value: adminStats.pendingReview,
              color:
                adminStats.pendingReview > 0
                  ? "text-yellow-600"
                  : "text-green-600",
            },
            {
              label: "KYC Users",
              value: adminStats.pendingKYC,
              color:
                adminStats.pendingKYC > 0
                  ? "text-yellow-600"
                  : "text-green-600",
            },
          ]}
          link="/admin/moderation"
          linkLabel="Review Queue"
        />

        {/* Users Card */}
        <SummaryCard
          title="User Base"
          icon={<Users className="h-5 w-5" />}
          stats={[
            { label: "Total Users", value: adminStats.totalUsers },
            {
              label: "Verified",
              value: adminStats.verifiedUsers,
              color: "text-blue-600",
            },
          ]}
          link="/admin/users"
          linkLabel="Manage Accounts"
        />

        {/* Finance Card */}
        <SummaryCard
          title="Financials"
          icon={<DollarSign className="h-5 w-5" />}
          stats={[
            {
              label: "Total Volume",
              value: formatCurrency(financialStats.totalSalesVolume),
            },
            {
              label: "Comm. Est.",
              value: formatCurrency(financialStats.estimatedCommission),
              color: "text-green-600",
            },
          ]}
          link="/admin/finance"
          linkLabel="View Ledger"
        />

        {/* Support Card */}
        <SummaryCard
          title="Support"
          icon={<MessageSquare className="h-5 w-5" />}
          stats={[
            {
              label: "Open Tickets",
              value: supportStats.open,
              color: supportStats.open > 0 ? "text-red-600" : "text-green-600",
            },
            { label: "Resolved", value: supportStats.resolved },
          ]}
          link="/admin/support"
          linkLabel="View Tickets"
        />

        {/* Communication Card */}
        <SummaryCard
          title="Communication"
          icon={<Megaphone className="h-5 w-5" />}
          stats={[
            { label: "Announcements", value: announcementStats.total },
            {
              label: "Last 7 Days",
              value: announcementStats.recent,
              color: "text-primary",
            },
          ]}
          link="/admin/announcements"
          linkLabel="Broadcast Update"
        />

        {/* System Card */}
        <SummaryCard
          title="System"
          icon={<TrendingUp className="h-5 w-5" />}
          stats={[
            { label: "Status", value: "Online", color: "text-green-600" },
            { label: "Version", value: "v1.2.0" },
          ]}
          link="/admin/settings"
          linkLabel="Configuration"
        />
      </div>
    </AdminLayout>
  );
}
