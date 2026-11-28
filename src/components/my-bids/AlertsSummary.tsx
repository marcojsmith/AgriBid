import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Bell, BellOff } from "lucide-react";
import { Link } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * What alerts the buyer gets on lots they bid on or watch, and a link to change
 * it. Watched-lot alerts are on unless the buyer turned them off (no saved
 * preferences means on).
 *
 * @returns The summary row, or a skeleton while preferences load
 */
export function AlertsSummary() {
  const prefs = useQuery(api.userPreferences.getMyPreferences);
  if (prefs === undefined) return <Skeleton className="h-12 w-full" />;
  const on = prefs?.notificationsWatchedLots !== false;
  const Icon = on ? Bell : BellOff;
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-0.5 size-[18px] text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">
          {on ? "Alerts on" : "Alerts off"}
        </p>
        <p className="text-sm text-muted-foreground">
          {on
            ? "You've been outbid · Closing in 1 hour"
            : "Turn them on to hear when you're outbid."}
        </p>
      </div>
      <Link
        to="/settings"
        className="inline-flex min-h-11 items-center text-[15px] font-semibold text-primary underline"
      >
        Change
      </Link>
    </div>
  );
}
