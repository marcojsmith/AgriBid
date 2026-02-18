import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Ban, Gavel } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

/**
 * Render an admin real-time feed of recent bids and controls to void individual bids.
 *
 * Fetches up to 20 recent bids and displays them in a table with time, auction title, bidder, and amount.
 * Rows for voided bids are visually de-emphasized and show the amount struck through.
 * Provides a per-row action to void a bid; voiding prompts for confirmation and shows a success or error toast.
 *
 * @returns A JSX element containing the real-time bids table with void controls and loading state handling.
 */
export function BidMonitor() {
  const bids = useQuery(api.admin.getRecentBids, { limit: 20 });
  const voidBid = useMutation(api.admin.voidBid);

  const handleVoid = async (bidId: Id<"bids">) => {
    if (!confirm("Are you sure you want to void this bid? This will recalculate the auction price.")) return;
    try {
        await voidBid({ bidId, reason: "Admin Action via Monitor" });
        toast.success("Bid voided");
    } catch (e) {
        toast.error("Failed to void bid");
    }
  };

  if (!bids) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <Card className="border-2 overflow-hidden bg-card/50">
        <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
            <h3 className="font-bold text-lg flex items-center gap-2"><Gavel className="h-4 w-4" /> Real-time Feed</h3>
            <span className="text-xs font-mono text-muted-foreground animate-pulse">● LIVE</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Auction</TableHead>
              <TableHead>Bidder</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bids.map((bid) => (
              <TableRow key={bid._id} className={bid.status === "voided" ? "opacity-50 bg-destructive/5" : ""}>
                <TableCell className="font-mono text-xs text-muted-foreground">{new Date(bid.timestamp).toLocaleTimeString()}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate" title={bid.auctionTitle}>{bid.auctionTitle}</TableCell>
                <TableCell className="font-mono text-xs">{bid.bidderId.substring(0, 8)}...</TableCell>
                <TableCell className="text-right font-bold">
                    {bid.status === "voided" ? (
                        <span className="line-through text-muted-foreground">R {bid.amount.toLocaleString()}</span>
                    ) : (
                        <span className="text-green-600">R {bid.amount.toLocaleString()}</span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    {bid.status !== "voided" && (
                        <Button variant="ghost" size="sm" onClick={() => handleVoid(bid._id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Ban className="h-4 w-4" />
                        </Button>
                    )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}