// app/src/pages/admin/tabs/SettingsTab.tsx
import { Hammer, TrendingUp, ShieldCheck } from "lucide-react";
import { SettingsCard } from "@/components/admin";
import { useAdminDashboard } from "../context/useAdminDashboard";
import { toast } from "sonner";

/**
 * Renders the admin system settings tab with management controls for metadata, fees, and security logs.
 *
 * Provides quick-action cards that:
 * - Redirect to external GitHub issues for Equipment Metadata and Platform Fees (placeholder behavior).
 * - Switch to the "Audit" tab for viewing security logs.
 *
 * @returns The system settings tab's JSX element.
 */
export function SettingsTab() {
  const { setActiveTab } = useAdminDashboard();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SettingsCard
          title="Equipment Metadata"
          description="Manage makes, models, and categories."
          icon={<Hammer />}
          action={() => {
            // Tracked in GH #55
            window.open("https://github.com/marcojsmith/AgriBid/issues/55", "_blank", "noopener,noreferrer");
            toast.info("Opening Equipment Metadata issue #55");
          }}
        />
        <SettingsCard
          title="Platform Fees"
          description="Configure commission rates and listing fees."
          icon={<TrendingUp />}
          action={() => {
            // Tracked in GH #56
            window.open("https://github.com/marcojsmith/AgriBid/issues/56", "_blank", "noopener,noreferrer");
            toast.info("Opening Platform Fees issue #56");
          }}
        />
        <SettingsCard
          title="Security Logs"
          description="Audit administrative actions and access."
          icon={<ShieldCheck />}
          action={() => setActiveTab("audit")}
        />
      </div>
    </div>
  );
}
