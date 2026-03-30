import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  Hammer,
  TrendingUp,
  ShieldCheck,
  Bug,
  Search,
  HelpCircle,
  Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { SettingsCard } from "@/components/admin/SettingsCard";

/**
 * Render the System Settings admin page, showing administrative statistics and actions for equipment metadata, platform fees, security logs, and error reporting.
 *
 * Displays a centred loading indicator while admin statistics are being fetched. Once loaded, presents four settings cards:
 * - Equipment Metadata: navigates to the internal equipment catalog management view.
 * - Platform Fees: routes internally to /admin/fees for fee rule management.
 * - Security Logs: navigates to the internal audit view.
 * - Error Reporting: configures GitHub issue creation for unexpected errors.
 *
 * @returns The AdminSettings page component as a React element.
 */
export default function AdminSettings() {
  const adminStats = useQuery(api.admin.getAdminStats);
  const navigate = useNavigate();

  if (adminStats === undefined) {
    return (
      <AdminLayout
        title="System Settings"
        subtitle="Platform Configuration & Metadata Management"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="System Settings"
      subtitle="Platform Configuration & Metadata Management"
    >
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SettingsCard
            title="Equipment Metadata"
            description="Manage makes, models, and categories."
            icon={<Hammer />}
            action={() => navigate("/admin/equipment-catalog")}
          />
          <SettingsCard
            title="Platform Fees"
            description="Configure commission rates and listing fees."
            icon={<TrendingUp />}
            action={() => navigate("/admin/fees")}
          />
          <SettingsCard
            title="Security Logs"
            description="Audit administrative actions and access."
            icon={<ShieldCheck />}
            action={() => navigate("/admin/audit")}
          />
          <SettingsCard
            title="Error Reporting"
            description="Configure GitHub issue creation for unexpected errors."
            icon={<Bug />}
            action={() => navigate("/admin/error-reporting")}
          />
          <SettingsCard
            title="SEO & Analytics"
            description="Configure GA4, Search Console, and Bing verification."
            icon={<Search />}
            action={() => navigate("/admin/seo")}
          />
          <SettingsCard
            title="Business Info"
            description="Organization details used for SEO structured data (JSON-LD)"
            icon={<Building2 />}
            action={() => navigate("/admin/business-info")}
          />
          <SettingsCard
            title="FAQ Management"
            description="Manage public FAQ questions and answers."
            icon={<HelpCircle />}
            action={() => navigate("/admin/faq")}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
