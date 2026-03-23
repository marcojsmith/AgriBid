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
  AlertCircle,
} from "lucide-react";

import { AdminLayout, AdminConnectionError } from "@/components/admin";
import { SummaryCard } from "@/components/admin/SummaryCard";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { formatCurrency } from "@/lib/currency";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

/**
 * Renders the Admin Dashboard overview with summary cards for all management areas.
 * @returns The admin dashboard page component
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
  const adminStats = useQuery(api.admin.getAdminStats);
  const financialStats = useQuery(api.admin.getFinancialStats, {});
  const announcementStats = useQuery(api.admin.getAnnouncementStats);
  const supportStats = useQuery(api.admin.getSupportStats);

  const isLoading =
    adminStats === undefined ||
    financialStats === undefined ||
    announcementStats === undefined ||
    supportStats === undefined;

  const hasTimedOut = useLoadingTimeout(isLoading);

  if (isLoading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-6">
        {!hasTimedOut ? (
          <>
            <LoadingIndicator size="lg" />
            <p className="text-muted-foreground font-medium animate-pulse">
              Aggregating marketplace intelligence...
            </p>
          </>
        ) : (
          <AdminConnectionError
            title="Dashboard Timeout"
            description="We're having trouble retrieving the latest metrics. This usually happens during peak load or maintenance windows."
          />
        )}
      </div>
    );
  }

  // Safe checks for potentially null/undefined data even after loading check if queries return null
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!adminStats || !financialStats || !announcementStats || !supportStats) {
    return (
      <div className="h-96 flex flex-col items-center justify-center text-center space-y-4">
        <AdminConnectionError
          title="Data Retrieval Error"
          description="The marketplace data could not be fully loaded. Please try again or contact system administrators."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {adminStats.status === "partial" && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 rounded-lg text-sm font-medium">
          <AlertCircle className="h-4 w-4" />
          Some statistics are currently partial or cached. Some metrics may not
          be fully accurate.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* User Base Card (Combined with Real-Time) */}
        <SummaryCard
          title="User Base"
          icon={<Users className="h-5 w-5" />}
          stats={[
            {
              label: "Currently Connected",
              value: adminStats.liveUsers,
              color: "text-green-600",
            },
            { label: "Registered Users", value: adminStats.totalUsers },
            {
              label: "Verified Sellers",
              value: adminStats.verifiedSellers,
              color: "text-blue-600",
            },
            {
              label: "KYC Pending",
              value: adminStats.kycPending,
              color: adminStats.kycPending > 0 ? "text-yellow-600" : undefined,
            },
          ]}
          link="/admin/users"
          linkLabel="Manage Accounts"
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
            { label: "Active Watch", value: adminStats.activeWatch },
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
            { label: "Version", value: `v${import.meta.env.VITE_APP_VERSION}` },
          ]}
          link="/admin/settings"
          linkLabel="Configuration"
        />
      </div>
    </div>
  );
}
