import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, DollarSign, Calendar } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { StatCard } from "./StatCard";

/**
 * Render the finance overview tab showing key statistics and a recent transactions table.
 *
 * Displays a centered loading indicator while financial stats are being fetched. When data is available,
 * renders three statistic cards (total sales volume, estimated commission, auctions settled) and a
 * table of recent sales with date, title, sale amount, and commission.
 *
 * @returns A React element containing the finance statistics and recent transactions UI.
 */
export function FinanceTab() {
  const stats = useQuery(api.admin.getFinancialStats);

  if (!stats) {
    return (
      <div className="flex justify-center p-8">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Total Sales Volume"
          value={`R ${stats.totalSalesVolume.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          color="text-green-600"
          padding="p-6"
          bgVariant="bg-card/50"
          iconSize="h-12 w-12"
        />
        <StatCard
          label={`Est. Commission (${(stats.commissionRate ?? 0.05) * 100}%)`}
          value={`R ${stats.estimatedCommission.toLocaleString()}`}
          icon={<TrendingUp className="h-5 w-5" />}
          color="text-primary"
          padding="p-6"
          bgVariant="bg-card/50"
          iconSize="h-12 w-12"
        />
        <StatCard
          label="Auctions Settled"
          value={stats.auctionCount}
          icon={<Calendar className="h-5 w-5" />}
          padding="p-6"
          bgVariant="bg-card/50"
          iconSize="h-12 w-12"
        />
      </div>

      <Card className="border-2 overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h3 className="font-bold text-lg">Recent Transactions</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Auction Title</TableHead>
              <TableHead className="text-right">Sale Amount</TableHead>
              <TableHead className="text-right">Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.recentSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No recent transactions
                </TableCell>
              </TableRow>
            ) : (
              stats.recentSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    {new Date(sale.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="font-medium">{sale.title}</TableCell>
                  <TableCell className="text-right font-bold">
                    R {sale.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    R {sale.estimatedCommission.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}