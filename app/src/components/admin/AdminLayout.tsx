// app/src/components/admin/AdminLayout.tsx
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  Gavel,
  Users,
  Clock,
  ShieldCheck,
  LayoutDashboard,
  Hammer,
  DollarSign,
  MessageSquare,
  FileText,
  Settings,
} from "lucide-react";
import { StatCard } from "./StatCard";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  stats: {
    activeAuctions: number;
    verifiedUsers: number;
    pendingReview: number;
    pendingKYC: number;
  } | null;
  onAnnounce?: () => void;
}

const SIDEBAR_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Moderation", icon: ShieldCheck, path: "/admin/moderation" },
  { label: "Auctions", icon: Hammer, path: "/admin/auctions" },
  { label: "Live Monitor", icon: Gavel, path: "/admin/marketplace" },
  { label: "Users", icon: Users, path: "/admin/users" },
  { label: "Finance", icon: DollarSign, path: "/admin/finance" },
  { label: "Announcements", icon: Megaphone, path: "/admin/announcements" },
  { label: "Support", icon: MessageSquare, path: "/admin/support" },
  { label: "Audit", icon: FileText, path: "/admin/audit" },
  { label: "System", icon: Settings, path: "/admin/settings" },
];

/**
 * Render a two-pane admin interface with a persistent left navigation sidebar and a right main area containing a KPI header and page content.
 *
 * @param children - Content rendered inside the main content area
 * @param title - Header title shown in the KPI header (defaults to "Admin Dashboard")
 * @param subtitle - Small uppercase subtitle shown under the title (defaults to "Global Marketplace Oversight")
 * @param stats - Optional KPI metrics; when provided renders three stat cards:
 *   - `activeAuctions` (Live)
 *   - `verifiedUsers` (Verified)
 *   - `pendingReview` and `pendingKYC` shown together as `"<pendingReview> · <pendingKYC>"` on the Moderation card; the Moderation card uses yellow styling if either pending value is greater than 0
 * @param onAnnounce - Optional callback invoked when the Announce button is clicked; the button is rendered only when this callback is provided
 * @returns The Admin layout React element containing the sidebar, KPI header (with optional action and stat cards) and the provided children
 */
export function AdminLayout({
  children,
  title = "Admin Dashboard",
  subtitle = "Global Marketplace Oversight",
  stats,
  onAnnounce,
}: AdminLayoutProps) {
  const location = useLocation();

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-background flex flex-col sticky top-16 h-[calc(100vh-64px)]">
        <div className="p-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">
            Management
          </h2>
          <nav className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path === "/admin" &&
                  location.pathname === "/admin/dashboard");
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all group",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4",
                      isActive
                        ? "text-primary-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden bg-background">
        <div className="flex flex-col min-h-full">
          {/* KPI Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-background px-8 py-4 border-b-2">
            <div className="space-y-0.5">
              <h1 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-primary" />
                {title}
              </h1>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                {subtitle}
              </p>
            </div>

            <div className="flex gap-4 items-center">
              {onAnnounce && (
                <Button
                  variant="outline"
                  className="gap-2 border-2 rounded-xl h-9 text-xs font-bold"
                  onClick={onAnnounce}
                >
                  <Megaphone className="h-3.5 w-3.5" /> Announce
                </Button>
              )}

              {stats && (
                <div className="flex flex-wrap gap-2">
                  <StatCard
                    label="Live"
                    value={stats.activeAuctions}
                    icon={<Gavel className="h-3 w-3" />}
                    color="text-green-500"
                    padding="p-2"
                    className="min-w-[100px] h-14"
                    iconSize="h-8 w-8"
                  />
                  <StatCard
                    label="Verified"
                    value={stats.verifiedUsers}
                    icon={<Users className="h-3 w-3" />}
                    padding="p-2"
                    className="min-w-[100px] h-14"
                    iconSize="h-8 w-8"
                  />
                  <StatCard
                    label="Moderation"
                    value={`${stats.pendingReview} · ${stats.pendingKYC}`}
                    icon={<Clock className="h-3 w-3" />}
                    color={
                      stats.pendingReview > 0 || stats.pendingKYC > 0
                        ? "text-yellow-500"
                        : ""
                    }
                    padding="p-2"
                    className="min-w-[150px] h-14"
                    iconSize="h-8 w-8"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}