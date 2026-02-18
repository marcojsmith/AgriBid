import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, DollarSign, Calendar } from "lucide-react";

export function FinanceTab() {
  const stats = useQuery(api.admin.getFinancialStats);

  if (!stats) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            label="Total Sales Volume" 
            value={`R ${stats.totalSalesVolume.toLocaleString()}`} 
            icon={<DollarSign className="h-5 w-5" />} 
            color="text-green-600"
        />
        <StatCard 
            label="Est. Commission (5%)" 
            value={`R ${stats.estimatedCommission.toLocaleString()}`} 
            icon={<TrendingUp className="h-5 w-5" />} 
            color="text-primary"
        />
        <StatCard 
            label="Auctions Settled" 
            value={stats.auctionCount} 
            icon={<Calendar className="h-5 w-5" />} 
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
            {stats.recentSales.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{sale.title}</TableCell>
                <TableCell className="text-right font-bold">R {sale.amount.toLocaleString()}</TableCell>
                <TableCell className="text-right text-muted-foreground">R {(sale.amount * 0.05).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, color = "" }: { label: string; value: number | string; icon: React.ReactNode; color?: string }) {
    return (
      <Card className="p-6 border-2 flex items-center justify-between bg-card/50 backdrop-blur-sm">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
          <p className={`text-2xl font-black ${color}`}>{value}</p>
        </div>
        <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      </Card>
    );
  }
