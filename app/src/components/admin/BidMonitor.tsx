import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
import { Button } from "@/components/ui/button";
import { Ban, Gavel } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Render an admin real-time feed of recent bids with controls to void individual bids.
 *
 * Displays up to 20 recent bids in a table (time, auction title, bidder, amount), highlights voided rows,
 * provides per-row void actions that require confirmation, and shows success or error toasts.
 *
 * @returns A JSX element containing the bids table, confirmation dialog and loading state.
 */
export function BidMonitor() {
  const bids = useQuery(api.admin.getRecentBids, { limit: 20 });
  const voidBid = useMutation(api.admin.voidBid);
  const [voidTarget, setVoidTarget] = useState<Id<"bids"> | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  const handleVoid = async () => {
    if (!voidTarget) return;
    setIsVoiding(true);
    try {
      await voidBid({ bidId: voidTarget, reason: "Admin Action via Monitor" });
      toast.success("Bid voided");
      setVoidTarget(null);
    } catch (err) {
      console.error("Failed to void bid:", err);
      toast.error(err instanceof Error ? err.message : "Failed to void bid");
    } finally {
      setIsVoiding(false);
    }
  };

  if (!bids) {
    return (
      <div className="flex justify-center p-8">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <Card className="border-2 overflow-hidden bg-card/50">
        <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Gavel className="h-4 w-4" /> Real-time Feed
          </h3>
          <span className="text-xs font-mono text-muted-foreground animate-pulse">
            ● LIVE
          </span>
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
            {bids.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Gavel className="h-8 w-8 opacity-20" />
                    <p className="font-black uppercase text-xs tracking-widest">
                      No bids yet
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              bids.map((bid) => (
                <TableRow
                  key={bid._id}
                  className={
                    bid.status === "voided" ? "opacity-50 bg-destructive/5" : ""
                  }
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(bid.timestamp).toLocaleTimeString()}
                  </TableCell>
                  <TableCell
                    className="font-medium truncate"
                    title={bid.auctionTitle}
                  >
                    {bid.auctionTitle}
                  </TableCell>
                  <TableCell className="font-mono text-xs" title={bid.bidderId}>
                    {bid.bidderId.substring(0, 8)}...
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {bid.status === "voided" ? (
                      <span className="line-through text-muted-foreground">
                        R {bid.amount.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-green-600">
                        R {bid.amount.toLocaleString()}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {bid.status !== "voided" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVoidTarget(bid._id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog
        open={!!voidTarget}
        onOpenChange={(open) => !open && setVoidTarget(null)}
      >
        <AlertDialogContent className="rounded-2xl border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-tight">
              Void Bid Transaction?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-sm">
              This will permanently invalidate this bid and recalculate the
              current auction price based on the next highest valid bid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isVoiding}
              className="rounded-xl border-2 font-bold uppercase text-[10px]"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={(e) => {
                e.preventDefault();
                handleVoid();
              }}
              disabled={isVoiding}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black uppercase text-[10px]"
            >
              {isVoiding ? (
                <LoadingIndicator size="sm" className="mr-2" />
              ) : null}
              Confirm Void
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}