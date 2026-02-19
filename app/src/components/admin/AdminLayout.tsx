// app/src/components/admin/AdminLayout.tsx
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Gavel, Users, Clock, TrendingUp } from "lucide-react";
import { StatCard } from "./StatCard";

interface AdminLayoutProps {
  children: ReactNode;
  stats: {
    activeAuctions: number;
    totalUsers: number;
    pendingReview: number;
  } | null;
  onAnnounce: () => void;
}

export function AdminLayout({ children, stats, onAnnounce }: AdminLayoutProps) {
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
            onClick={onAnnounce}
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

      {children}
    </div>
  );
}
