// app/src/pages/admin/AdminAuctions.tsx
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Link } from "react-router-dom";
import { Plus, Calendar, Image as ImageIcon, Users } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/utils";

import { AuctionFormDialog } from "./auctions/AuctionFormDialog";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/10 text-success border-success/20",
  closed: "bg-primary/10 text-primary border-primary/20",
};

/**
 * Admin page listing scheduled auction events (multi-lot sale containers).
 * Supports creating new events and links through to each event's lot
 * assignment screen.
 *
 * @returns The AdminAuctions page component.
 */
export default function AdminAuctions() {
  const auctionEvents = useQuery(api.auctions.getAllAuctions);
  const publishAuctionContainer = useMutation(
    api.auctions.mutations.adminCrud.publishAuctionContainer
  );
  const closeAuctionContainer = useMutation(
    api.auctions.mutations.adminCrud.closeAuctionContainer
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"auctions"> | null>(null);
  const [busyId, setBusyId] = useState<Id<"auctions"> | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (id: Id<"auctions">) => {
    setEditingId(id);
    setFormOpen(true);
  };

  const handlePublish = async (id: Id<"auctions">) => {
    setBusyId(id);
    try {
      await publishAuctionContainer({ auctionId: id });
      toast.success("Auction published");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to publish auction"));
    } finally {
      setBusyId(null);
    }
  };

  const handleClose = async (id: Id<"auctions">) => {
    setBusyId(id);
    try {
      await closeAuctionContainer({ auctionId: id });
      toast.success("Auction closed");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to close auction"));
    } finally {
      setBusyId(null);
    }
  };

  if (auctionEvents === undefined) {
    return (
      <AdminLayout title="Auctions" subtitle="Manage Scheduled Sales">
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Auctions" subtitle="Manage Scheduled Sales">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex justify-end">
          <Button
            onClick={openCreate}
            className="gap-2"
            data-testid="create-auction-event"
          >
            <Plus className="h-4 w-4" />
            New Auction
          </Button>
        </div>

        {auctionEvents.length === 0 ? (
          <Card className="border">
            <div className="text-center py-16 space-y-4">
              <Calendar className="h-10 w-10 text-muted-foreground/20 mx-auto" />
              <p className="text-muted-foreground font-bold">
                No auction events yet. Create one to start scheduling sales.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {auctionEvents.map((event) => (
              <Card
                key={event._id}
                className="overflow-hidden border flex flex-col"
              >
                <div className="h-32 bg-muted relative">
                  {event.bannerImageUrl ? (
                    <img
                      src={event.bannerImageUrl}
                      alt={event.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <Badge
                    className={`absolute top-2 right-2 font-semibold text-xs capitalize ${STATUS_BADGE[event.status] ?? ""}`}
                  >
                    {event.status}
                  </Badge>
                </div>
                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div>
                    <h3 className="font-bold text-sm leading-tight">
                      {event.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(event.startTime).toLocaleString()} –{" "}
                      {new Date(event.endTime).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <Users className="h-3 w-3" />
                    {event.lotCount} lot{event.lotCount === 1 ? "" : "s"}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-auto pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      asChild
                    >
                      <Link to={`/admin/auctions/${event._id}`}>
                        Manage Lots
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={() => {
                        openEdit(event._id);
                      }}
                    >
                      Edit
                    </Button>
                    {event.status === "draft" && (
                      <Button
                        size="sm"
                        className="text-xs h-8"
                        disabled={busyId === event._id}
                        onClick={() => {
                          void handlePublish(event._id);
                        }}
                      >
                        Publish
                      </Button>
                    )}
                    {event.status === "published" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs h-8"
                        disabled={busyId === event._id}
                        onClick={() => {
                          void handleClose(event._id);
                        }}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AuctionFormDialog
        open={formOpen}
        auctionId={editingId}
        onOpenChange={setFormOpen}
      />
    </AdminLayout>
  );
}
