import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";

import type { MyBidsStats } from "./bidTypes";

interface BidStatsProps {
  /** Aggregate bid statistics for the signed-in user. */
  stats: MyBidsStats;
}

/**
 * The four summary tiles above the "My Bids" list: active bids, lots the user
 * is winning, lots the user has been outbid on and total exposure.
 *
 * @param props - Component props
 * @param props.stats - Aggregate bid statistics for the signed-in user
 * @returns The rendered statistics grid
 */
export function BidStats({ stats }: BidStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-card/50 border">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Active Bids
          </p>
          <p className="text-3xl font-bold text-primary">{stats.totalActive}</p>
        </CardContent>
      </Card>
      <Card className="bg-card/50 border">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Winning
          </p>
          <p className="text-3xl font-bold text-success">
            {stats.winningCount}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-card/50 border">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Outbid
          </p>
          <p className="text-3xl font-bold text-destructive">
            {stats.outbidCount}
          </p>
        </CardContent>
      </Card>
      <Card className="bg-card/50 border">
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold text-muted-foreground mb-1">
            Total Exposure
          </p>
          <p className="text-xl font-bold text-primary">
            {formatCurrency(stats.totalExposure)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
