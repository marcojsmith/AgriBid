// app/src/pages/admin/tabs/SettingsTab.tsx
import { TabsContent } from "@/components/ui/tabs";
import { Hammer, TrendingUp, ShieldCheck } from "lucide-react";
import { SettingsCard } from "@/components/admin";
import { useAdminDashboard } from "../context/useAdminDashboard";
import { toast } from "sonner";

/**
 * Render the admin Settings tab containing cards for Equipment Metadata, Platform Fees, and Security Logs.
 *
 * Each card displays a title, description, and icon; the first two cards show informational toasts when activated,
 * and the Security Logs card switches the active admin tab to "audit".
 *
 * @returns The tab panel JSX element containing three SettingsCard components wired to their respective actions.
 */
export function SettingsTab() {
  const { setActiveTab } = useAdminDashboard();

  return (
    <TabsContent
      value="settings"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SettingsCard
          title="Equipment Metadata"
          description="Manage makes, models, and categories."
          icon={<Hammer />}
          action={() => {
            // TODO: Navigate to /admin/equipment-metadata or open management UI
            toast.info("Equipment Metadata management coming soon");
          }}
        />
        <SettingsCard
          title="Platform Fees"
          description="Configure commission rates and listing fees."
          icon={<TrendingUp />}
          action={() => {
            // TODO: Navigate to /admin/platform-fees or open fee config UI
            toast.info("Platform Fees configuration coming soon");
          }}
        />
        <SettingsCard
          title="Security Logs"
          description="Audit administrative actions and access."
          icon={<ShieldCheck />}
          action={() => setActiveTab("audit")}
        />
      </div>
    </TabsContent>
  );
}