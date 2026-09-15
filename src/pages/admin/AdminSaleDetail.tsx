// app/src/pages/admin/AdminSaleDetail.tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { getErrorMessage } from "@/lib/utils";

/**
 * Admin page for managing which lots are assigned to a specific auction
 * event: lists lots already assigned (with an unassign action) and approved
 * lots still awaiting assignment (with an assign action).
 *
 * @returns The AdminSaleDetail page component.
 */
export default function AdminSaleDetail() {
  const { id } = useParams<{ id: string }>();
  const auctionId = id as Id<"auctions"> | undefined;

  const event = useQuery(
    api.auctions.getAuctionEventById,
    auctionId ? { auctionId } : "skip"
  );
  const candidates = useQuery(
    api.auctions.getAssignmentCandidates,
    auctionId ? { auctionId } : "skip"
  );

  const assignLotToAuction = useMutation(
    api.auctions.mutations.assignment.assignLotToAuction
  );
  const unassignLot = useMutation(
    api.auctions.mutations.assignment.unassignLot
  );

  const [busyLotId, setBusyLotId] = useState<Id<"lots"> | null>(null);

  const handleAssign = async (lotId: Id<"lots">) => {
    if (!auctionId) return;
    setBusyLotId(lotId);
    try {
      await assignLotToAuction({ lotId, auctionId });
      toast.success("Lot assigned");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to assign lot"));
    } finally {
      setBusyLotId(null);
    }
  };

  const handleUnassign = async (lotId: Id<"lots">) => {
    setBusyLotId(lotId);
    try {
      await unassignLot({ lotId });
      toast.success("Lot unassigned");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to unassign lot"));
    } finally {
      setBusyLotId(null);
    }
  };

  if (event === undefined || candidates === undefined) {
    return (
      <AdminLayout title="Auction Event" subtitle="Manage Lot Assignments">
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  if (event === null) {
    return (
      <AdminLayout title="Auction Event" subtitle="Manage Lot Assignments">
        <div className="max-w-lg mx-auto py-24 text-center space-y-4">
          <h1 className="text-2xl font-bold">Auction Not Found</h1>
          <Button asChild variant="outline">
            <Link to="/admin/sales">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Auction Events
            </Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={event.title} subtitle="Manage Lot Assignments">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <Button asChild variant="ghost" size="sm" className="gap-2 -ml-2">
          <Link to="/admin/sales">
            <ArrowLeft className="h-4 w-4" /> Back to Auction Events
          </Link>
        </Button>

        <Card className="p-4 flex flex-wrap items-center justify-between gap-4 border">
          <div>
            <p className="text-xs text-muted-foreground font-semibold">
              Window
            </p>
            <p className="text-sm font-bold">
              {new Date(event.startTime).toLocaleString()} –{" "}
              {new Date(event.endTime).toLocaleString()}
            </p>
          </div>
          <Badge className="capitalize font-semibold">{event.status}</Badge>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
              Assigned Lots ({candidates.assigned.length})
            </h2>
            {candidates.assigned.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground border border-dashed">
                No lots assigned yet.
              </Card>
            ) : (
              <div className="space-y-2">
                {candidates.assigned.map((lot) => (
                  <Card
                    key={lot._id}
                    className="p-3 flex items-center justify-between gap-3 border"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {lot.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(lot.currentPrice)} · {lot.status}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs h-8 gap-1"
                      disabled={busyLotId === lot._id}
                      onClick={() => {
                        void handleUnassign(lot._id);
                      }}
                    >
                      <X className="h-3 w-3" /> Unassign
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
              Approved &amp; Awaiting Assignment ({candidates.unassigned.length})
            </h2>
            {candidates.unassigned.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground border border-dashed">
                No approved lots waiting for assignment.
              </Card>
            ) : (
              <div className="space-y-2">
                {candidates.unassigned.map((lot) => (
                  <Card
                    key={lot._id}
                    className="p-3 flex items-center justify-between gap-3 border"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {lot.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(lot.currentPrice)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 text-xs h-8 gap-1"
                      disabled={busyLotId === lot._id}
                      onClick={() => {
                        void handleAssign(lot._id);
                      }}
                    >
                      <Plus className="h-3 w-3" /> Assign
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
