import { UserCheck } from "lucide-react";

import { LoadingIndicator } from "@/components/LoadingIndicator";
import { ACTIVITY_META, formatActivityDate } from "@/lib/profile-utils";
import type { ActivityType } from "@/types/profile";

interface ActivityItem {
  _id: string;
  type: ActivityType;
  description?: string;
  createdAt: number;
}

interface ActivityFeedProps {
  /** Array of activity items or undefined while loading */
  activity: ActivityItem[] | undefined;
}

/**
 * Renders the Recent Activity feed for a user profile.
 *
 * @param props - Component props
 * @param props.activity - Array of activity items or undefined while loading
 * @returns A section with activity items or empty/loading state
 */
export function ActivityFeed({ activity }: ActivityFeedProps) {
  const items = activity ?? [];

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <UserCheck className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
      </div>

      {activity === undefined ? (
        <LoadingIndicator />
      ) : items.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded p-8 text-center">
          <p className="text-muted-foreground font-bold uppercase tracking-widest italic text-sm">
            No activity yet
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {items.map((item) => {
            const meta = ACTIVITY_META[item.type];
            const Icon = meta.icon;
            return (
              <div
                key={item._id}
                className="flex items-start gap-3 py-3 border-b border-border last:border-0"
              >
                <div
                  className={`h-9 w-9 rounded flex items-center justify-center flex-shrink-0 ${meta.bgClass}`}
                >
                  <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {item.description ?? meta.title}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatActivityDate(item.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
