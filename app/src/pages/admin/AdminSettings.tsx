import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { Hammer, TrendingUp, ShieldCheck } from "lucide-react";
import { SettingsCard } from "@/components/admin";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function AdminSettings() {
  const adminStats = useQuery(api.admin.getAdminStats);
  const navigate = useNavigate();

  if (adminStats === undefined) {
    return (
      <AdminLayout
        stats={null}
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
      stats={adminStats}
      title="System Settings"
      subtitle="Platform Configuration & Metadata Management"
    >
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SettingsCard
            title="Equipment Metadata"
            description="Manage makes, models, and categories."
            icon={<Hammer />}
            action={() => {
              window.open(
                "https://github.com/marcojsmith/AgriBid/issues/55",
                "_blank",
                "noopener,noreferrer"
              );
              toast.info("Opening Equipment Metadata issue #55");
            }}
          />
          <SettingsCard
            title="Platform Fees"
            description="Configure commission rates and listing fees."
            icon={<TrendingUp />}
            action={() => {
              window.open(
                "https://github.com/marcojsmith/AgriBid/issues/56",
                "_blank",
                "noopener,noreferrer"
              );
              toast.info("Opening Platform Fees issue #56");
            }}
          />
          <SettingsCard
            title="Security Logs"
            description="Audit administrative actions and access."
            icon={<ShieldCheck />}
            action={() => navigate("/admin/audit")}
          />
        </div>
      </div>
    </AdminLayout>
  );
}
