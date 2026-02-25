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
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { formatCurrency } from "@/lib/currency";
import { useAdminStats } from "@/contexts/useAdminStats";

/**
 * Renders the Admin Dashboard overview with summary cards for all management areas.
 */
export default function AdminDashboard() {
  return (
    <AdminLayout title="Admin Overview" subtitle="Marketplace Control Centre">
      <AdminDashboardContent />
    </AdminLayout>
  );
}

/**
 * Display the admin dashboard grid of summary cards for Real-Time, auctions, moderation, users, financials, support, communication and system.
 *
 * While required stats are being fetched, displays a centred loading indicator. If any required dataset is missing after loading, shows an error message prompting the user to refresh or contact support.
 *
 * @returns The dashboard JSX element when data is available; a centred loading indicator while data is being fetched; or an error message UI if required data is missing.
 */
function AdminDashboardContent() {
  const adminStats = useAdminStats();
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
      <div className="h-96 flex items-center justify-center">
        <LoadingIndicator />
      </div>
    );
  }

  // Safe checks for potentially null/undefined data even after loading check if queries return null
  if (!adminStats || !financialStats || !announcementStats || !supportStats) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-center gap-4">
        <p className="text-muted-foreground">Unable to load dashboard data.</p>
        <p className="text-sm text-muted-foreground">
          Please refresh the page or contact support if the issue persists.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Real-Time Card (Placeholder for now) */}
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
            label: "Pending Review",
            value: adminStats.pendingReview,
            color:
              adminStats.pendingReview > 0
                ? "text-yellow-600"
                : "text-green-600",
          },
          { label: "KYC Queue", value: adminStats.kycPending },
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
            value: adminStats.verifiedSellers,
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
          { label: "Version", value: `v${import.meta.env.VITE_APP_VERSION}` },
        ]}
        link="/admin/settings"
        linkLabel="Configuration"
      />
    </div>
  );
}
