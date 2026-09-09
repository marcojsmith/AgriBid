// app/src/components/admin/AdminLayout.tsx
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Megaphone,
  Gavel,
  Users,
  Clock,
  TrendingUp,
  ShieldCheck,
  LayoutDashboard,
  Hammer,
  LayoutGrid,
  DollarSign,
  MessageSquare,
  FileText,
  Settings,
  Activity,
  Bug,
  Building2,
  Menu,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminStatsProvider } from "@/contexts/AdminStatsContext";
import { useAdminStats } from "@/hooks/useAdminStats";

import { StatCard } from "./StatCard";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  // stats prop removed, handled internally by context
  onAnnounce?: () => void;
}

interface SidebarNavProps {
  currentPath: string;
  onNavigate?: () => void;
}

/**
 * Render the admin sidebar navigation links, highlighting the active route.
 *
 * @param props - Component props
 * @param props.currentPath - The current route pathname, used to highlight the active link
 * @param props.onNavigate - Optional callback invoked when a link is clicked (used to close the mobile drawer)
 * @returns The rendered navigation list
 */
function SidebarNav({ currentPath, onNavigate }: SidebarNavProps) {
  return (
    <nav className="space-y-1">
      {SIDEBAR_ITEMS.map((item) => {
        const isActive =
          currentPath === item.path ||
          (item.path === "/admin" && currentPath === "/admin/dashboard");
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all group",
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
  );
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
  { label: "Equipment", icon: LayoutGrid, path: "/admin/equipment-catalog" },
  { label: "Audit", icon: FileText, path: "/admin/audit" },
  { label: "System", icon: Settings, path: "/admin/settings" },
  { label: "Business Info", icon: Building2, path: "/admin/business-info" },
  { label: "Error Reports", icon: Bug, path: "/admin/error-reports" },
];

/**
 * Render the admin layout with a persistent sidebar, KPI header and main content area.
 *
 * @param props - Properties controlling the layout: `children`, optional `title` and `subtitle`, and optional `onAnnounce` callback.
 * @returns The layout element wrapped with admin stats context, containing the sidebar, KPI header and main content area.
 */
export function AdminLayout(props: AdminLayoutProps) {
  return (
    <AdminStatsProvider>
      <AdminLayoutContent {...props} />
    </AdminStatsProvider>
  );
}

/**
 * Renders the admin layout content: sidebar navigation, KPI header and main content area.
 *
 * Reads admin statistics from context and displays stat cards when available; shows an Announce
 * button when `onAnnounce` is provided. `title` and `subtitle` appear in the header and
 * `children` are rendered as the main content.
 *
 * @param props - Properties controlling the layout content
 * @param props.children - Main content to render
 * @param props.title - Header title
 * @param props.subtitle - Header subtitle
 * @param props.onAnnounce - Announcement callback
 * @returns The layout content element for admin pages
 */
function AdminLayoutContent({
  children,
  title = "Admin Dashboard",
  subtitle = "Global Marketplace Oversight",
  onAnnounce,
}: AdminLayoutProps) {
  const location = useLocation();
  const stats = useAdminStats();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileNavOpen]);

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-muted/30">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 border-r bg-background flex-col sticky top-16 h-[calc(100vh-64px)] shrink-0">
        <div className="p-6">
          <h2 className="text-xs font-medium text-muted-foreground mb-6">
            Management
          </h2>
          <SidebarNav currentPath={location.pathname} />
        </div>
      </aside>

      {/* Sidebar — mobile drawer */}
      {isMobileNavOpen && (
        <div
          data-testid="admin-mobile-nav-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
          className="fixed inset-0 z-[100] lg:hidden"
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm cursor-default"
            onClick={() => {
              setIsMobileNavOpen(false);
            }}
            aria-label="Close navigation overlay"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-background border-r flex flex-col animate-in slide-in-from-left duration-200">
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-medium text-muted-foreground">
                  Management
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -mr-2"
                  onClick={() => {
                    setIsMobileNavOpen(false);
                  }}
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SidebarNav
                currentPath={location.pathname}
                onNavigate={() => {
                  setIsMobileNavOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-x-hidden bg-background">
        <div className="flex flex-col min-h-full">
          {/* KPI Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-background px-4 md:px-8 py-4 border-b">
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-md lg:hidden shrink-0"
                onClick={() => {
                  setIsMobileNavOpen(true);
                }}
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="space-y-0.5 min-w-0">
                <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                  <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
                  <span className="truncate">{title}</span>
                </h1>
                <p className="text-muted-foreground text-xs font-medium">
                  {subtitle}
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-center">
              {onAnnounce && (
                <Button
                  variant="outline"
                  className="gap-2 border rounded-md h-9 text-xs font-medium"
                  onClick={onAnnounce}
                >
                  <Megaphone className="h-3.5 w-3.5" /> Announce
                </Button>
              )}

              {stats && (
                <div className="flex flex-wrap gap-2">
                  <StatCard
                    label="Online Users"
                    value={stats.liveUsers}
                    icon={<Activity className="h-3 w-3" />}
                    color="text-green-500"
                    padding="p-2"
                    className="min-w-[100px] h-14"
                    iconSize="h-8 w-8"
                  />
                  <StatCard
                    label="Users"
                    value={stats.totalUsers}
                    icon={<Users className="h-3 w-3" />}
                    padding="p-2"
                    className="min-w-[100px] h-14"
                    iconSize="h-8 w-8"
                  />
                  <StatCard
                    label="Moderation"
                    value={stats.pendingReview}
                    icon={<Clock className="h-3 w-3" />}
                    color={stats.pendingReview > 0 ? "text-yellow-500" : ""}
                    padding="p-2"
                    className="min-w-[100px] h-14"
                    iconSize="h-8 w-8"
                  />
                  <StatCard
                    label="Growth"
                    value="—"
                    icon={<TrendingUp className="h-3 w-3" />}
                    color="text-primary"
                    padding="p-2"
                    className="min-w-[100px] h-14"
                    iconSize="h-8 w-8"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 md:p-8 overflow-x-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
