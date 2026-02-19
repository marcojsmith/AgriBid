// app/src/pages/admin/AdminDashboardContent.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Clock,
  Hammer,
  Users,
  DollarSign,
  MessageSquare,
  FileText,
  Settings,
  Search,
  Filter,
  Megaphone,
  Gavel,
  TrendingUp,
} from "lucide-react";
import { StatCard } from "@/components/admin";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { useAdminDashboard } from "./context/useAdminDashboard";
import { ModerationTab } from "./tabs/ModerationTab";
import { MarketplaceTab } from "./tabs/MarketplaceTab";
import { UsersTab } from "./tabs/UsersTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { FinanceTab } from "@/components/admin/FinanceTab";
import { SupportTab } from "@/components/admin/SupportTab";
import { AuditTab } from "@/components/admin/AuditTab";
import { AdminDialogs } from "./AdminDialogs";

/**
 * Render the admin portal UI that displays a header, quick statistics, and a tabbed interface for moderation, marketplace, users, finance, support, audit, and system settings.
 *
 * Renders a full-screen initializing state while essential dashboard data is loading, then shows the main layout with search/filter controls, contextual stat cards, tab triggers (including pending counts), tab content components, and admin dialogs.
 *
 * @returns The Admin Dashboard content element containing header, stats, tabbed navigation, and dialogs.
 */
export function AdminDashboardContent() {
  const {
    pendingAuctions,
    allAuctions,
    allProfiles,
    stats,
    activeTab,
    setActiveTab,
    auctionSearch,
    setAuctionSearch,
    userSearch,
    setUserSearch,
    setAnnouncementOpen,
  } = useAdminDashboard();

  if (
    pendingAuctions === undefined ||
    allAuctions === undefined ||
    allProfiles === undefined
  ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <LoadingIndicator />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
          Initializing Terminal...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-10">
      {/* Header & Quick Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
        <div className="space-y-2">
          <Badge className="bg-primary/10 text-primary border-primary/20 font-black uppercase tracking-widest text-[10px]">
            Command Center
          </Badge>
          <h1 className="text-6xl font-black uppercase tracking-tighter">
            Admin Portal
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-sm tracking-wide">
            Global management and marketplace oversight.
          </p>
        </div>

        <div className="flex gap-4 items-center">
          <Button
            variant="outline"
            className="gap-2 border-2 rounded-xl"
            onClick={() => setAnnouncementOpen(true)}
          >
            <Megaphone className="h-4 w-4" /> Announce
          </Button>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-auto">
              <StatCard
                label="Live Auctions"
                value={stats.activeAuctions}
                icon={<Gavel className="h-4 w-4" />}
                color="text-green-500"
              />
              <StatCard
                label="Total Users"
                value={stats.totalUsers}
                icon={<Users className="h-4 w-4" />}
              />
              <StatCard
                label="Moderation"
                value={stats.pendingReview}
                icon={<Clock className="h-4 w-4" />}
                color={stats.pendingReview > 0 ? "text-yellow-500" : ""}
              />
              <StatCard
                label="Platform Growth"
                value="—"
                icon={<TrendingUp className="h-4 w-4" />}
                color="text-primary"
              />
            </div>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 pt-4 overflow-x-auto w-full">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-nowrap md:flex-wrap w-full md:w-auto overflow-x-auto justify-start">
            <TabsTrigger
              value="moderation"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Moderation</span>
              {pendingAuctions.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 px-1.5 text-[9px]"
                >
                  {pendingAuctions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="auctions"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <Hammer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Marketplace</span>
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Finance</span>
            </TabsTrigger>
            <TabsTrigger
              value="support"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Support</span>
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-lg font-black uppercase tracking-wider text-xs px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-lg gap-2"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder={
                  activeTab === "users" ? "Search Users..." : "Search..."
                }
                className="pl-10 h-11 w-[200px] lg:w-[300px] bg-muted/30 border-2 rounded-xl focus:ring-primary/20"
                value={activeTab === "users" ? userSearch : auctionSearch}
                onChange={(e) =>
                  activeTab === "users"
                    ? setUserSearch(e.target.value)
                    : setAuctionSearch(e.target.value)
                }
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 border-2 rounded-xl opacity-50 cursor-not-allowed"
              aria-label="Filter results (coming soon)"
              disabled
              title="Filtering coming soon"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ModerationTab />
        <MarketplaceTab />
        <UsersTab />
        
        <TabsContent value="finance">
          <FinanceTab />
        </TabsContent>
        <TabsContent value="support">
          <SupportTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
        
        <SettingsTab />
      </Tabs>

      <AdminDialogs />
    </div>
  );
}