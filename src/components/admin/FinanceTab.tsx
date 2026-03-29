import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  DollarSign,
  AlertCircle,
  Users,
  Building2,
  Calendar,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingIndicator } from "@/components/LoadingIndicator";

import { StatCard } from "./StatCard";

/**
 * Finance overview tab showing key statistics and recent transactions.
 * @returns The FinanceTab React component.
 */
export function FinanceTab() {
  const stats = useQuery(api.admin.getFinancialStats, {});

  if (!stats) {
    return (
      <div className="flex justify-center p-8">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {stats.partialResults && (
        <div
          className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 text-warning rounded-lg text-sm font-medium"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          Sales volume figures are calculated from live data and may be
          incomplete. Run initialize counters to reconcile.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          label="Total Sales Volume"
          value={`R ${stats.totalSalesVolume.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          color="text-success"
          padding="p-6"
          bgVariant="bg-card/50"
          iconSize="h-12 w-12"
        />
        <StatCard
          label="Total Fees Collected"
          value={`R ${stats.totalFeesCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="h-5 w-5" />}
          color="text-primary"
          padding="p-6"
          bgVariant="bg-card/50"
          iconSize="h-12 w-12"
        />
        <StatCard
          label="Buyer Fees"
          value={`R ${stats.buyerFeesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<Users className="h-5 w-5" />}
          color="text-primary"
          padding="p-6"
          bgVariant="bg-card/50"
          iconSize="h-12 w-12"
        />
        <StatCard
          label="Seller Fees"
          value={`R ${stats.sellerFeesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<Building2 className="h-5 w-5" />}
          color="text-success"
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
              <TableHead className="text-right">Fees</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.recentSales.page.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  No recent transactions
                </TableCell>
              </TableRow>
            ) : (
              stats.recentSales.page.map((sale) => {
                const totalFees = sale.fees.reduce(
                  (sum, f) => sum + f.amount,
                  0
                );
                return (
                  <TableRow key={sale.id}>
                    <TableCell>
                      {new Date(sale.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">{sale.title}</TableCell>
                    <TableCell className="text-right font-bold">
                      R {sale.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {sale.fees.length > 0 ? (
                        <div className="space-y-1">
                          <div className="font-medium">
                            R{" "}
                            {totalFees.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {sale.fees
                              .map(
                                (f) =>
                                  `${f.feeName}: ${f.appliedTo === "buyer" ? "B" : "S"} R${f.amount.toFixed(2)}`
                              )
                              .join(", ")}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
