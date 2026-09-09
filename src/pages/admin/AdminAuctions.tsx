import { useMemo, useState } from "react";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { Clock, MoreVertical, Eye, AlertCircle, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/currency";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import type { AuctionWithCategory } from "@/types/auction";
import { useBulkOperations } from "@/hooks/admin/useBulkOperations";

import { BulkActionDialog } from "./dialogs/BulkActionDialog";

/**
 * Format time remaining until a given timestamp.
 * @param endTime - The timestamp when the auction ends
 * @returns A human-readable string representing the time remaining
 */
function formatTimeRemaining(endTime: number): string {
  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) return "Ended";

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${String(days)} day${days > 1 ? "s" : ""}, ${String(remainingHours)} hour${remainingHours !== 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${String(hours)} hour${hours > 1 ? "s" : ""}, ${String(remainingMinutes)} min`;
  }
  if (minutes > 0) {
    return `${String(minutes)} minute${minutes > 1 ? "s" : ""}`;
  }
  return `${String(seconds)} second${seconds !== 1 ? "s" : ""}`;
}

/**
 * Admin auctions management UI with search, selectable paginated listings, per-row actions and bulk status update workflows.
 *
 * Renders a searchable table of auctions with status badges, row selection (including indeterminate state), contextual actions per row, "Load More" pagination and a confirmation dialog for bulk status changes.
 *
 * @returns A React element that renders the admin auctions management interface
 */
export default function AdminAuctions() {
  const navigate = useNavigate();
  const adminStats = useQuery(api.admin.getAdminStats);
  const {
    results: allAuctions,
    status: auctionsStatus,
    loadMore: loadMoreAuctions,
  } = usePaginatedQuery(
    api.auctions.getAllAuctions,
    {},
    { initialNumItems: 50 }
  );

  // Use custom hook for all auction selection and bulk operation state
  const {
    auctionSearch,
    setAuctionSearch,
    selectedAuctions,
    clearSelection,
    handleSelectAll,
    handleToggleSelection,
    isBulkProcessing,
    bulkStatusTarget,
    setBulkStatusTarget,
    getSelectionState,
    handleBulkStatusUpdate,
  } = useBulkOperations();

  const [closingAuction, setClosingAuction] = useState<Doc<"auctions"> | null>(
    null
  );
  const [isClosing, setIsClosing] = useState(false);

  const closeAuctionEarly = useMutation(
    api.auctions.mutations.publish.closeAuctionEarly
  );

  /**
   * Opens the confirmation dialog to force end an auction.
   * @param auction - The auction to close early
   */
  const handleForceEnd = (auction: Doc<"auctions">): void => {
    setClosingAuction(auction);
  };

  /**
   * Closes the auction early after user confirmation.
   * Calls the backend mutation and shows appropriate toast feedback.
   * @param e - The click event to prevent automatic dialog close
   */
  const handleCloseAuction = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    if (!closingAuction) return;

    setIsClosing(true);
    try {
      const result = await closeAuctionEarly({ auctionId: closingAuction._id });

      if (result.success) {
        if (
          result.finalStatus === "sold" &&
          result.winnerId &&
          result.winningAmount !== undefined
        ) {
          toast.success(
            `Auction closed successfully. Awarded to highest bidder for ${formatCurrency(result.winningAmount)}`
          );
        } else {
          toast.success(
            "Auction closed. Reserve price not met—marked as unsold"
          );
        }
      } else {
        toast.error(result.error ?? "Failed to close auction");
      }
    } catch {
      toast.error("Network error—please try again");
    } finally {
      setIsClosing(false);
      setClosingAuction(null);
    }
  };

  const filteredAuctions = useMemo(() => {
    // `results` is typed non-nullable but the loading-state path feeds
    // `undefined`, so the empty-array fallback is kept intentionally.
    const auctions = allAuctions as AuctionWithCategory[] | undefined;
    return (auctions ?? []).filter(
      (a) =>
        a.title.toLowerCase().includes(auctionSearch.toLowerCase()) ||
        a.make.toLowerCase().includes(auctionSearch.toLowerCase()) ||
        a.model.toLowerCase().includes(auctionSearch.toLowerCase()) ||
        a.categoryName?.toLowerCase().includes(auctionSearch.toLowerCase())
    );
  }, [allAuctions, auctionSearch]);

  // Get computed selection state based on filtered auctions
  const { isAllSelected, isPartiallySelected } = useMemo(
    () => getSelectionState(filteredAuctions),
    [filteredAuctions, getSelectionState]
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success/10 text-success border-success/20 font-semibold text-xs">
            Active
          </Badge>
        );
      case "pending_review":
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20 font-semibold text-xs">
            Pending
          </Badge>
        );
      case "sold":
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs">
            Sold
          </Badge>
        );
      case "unsold":
        return (
          <Badge className="bg-muted text-muted-foreground font-semibold text-xs">
            Unsold
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="font-semibold text-xs">
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (auctionsStatus === "LoadingFirstPage") {
    return (
      <AdminLayout
        title="Auction Marketplace"
        subtitle="Comprehensive Listing & Inventory Management"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Auction Marketplace"
      subtitle="Comprehensive Listing & Inventory Management"
    >
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/20 p-4 rounded-md border border-dashed">
          <div className="relative group w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search Auctions..."
              className="pl-9 h-9 border rounded-md bg-background focus-visible:ring-primary/20"
              value={auctionSearch}
              onChange={(e) => {
                setAuctionSearch(e.target.value);
              }}
            />
          </div>
          <Badge variant="secondary" className="font-bold">
            Showing {filteredAuctions.length} of{" "}
            {adminStats ? adminStats.totalAuctions : "—"} Auctions
          </Badge>
        </div>
        <Card className="border overflow-hidden bg-card/50 backdrop-blur-sm">
          {selectedAuctions.length > 0 && (
            <div className="bg-primary/10 border-b p-4 flex items-center justify-between animate-in slide-in-from-top-4">
              <p className="text-sm font-semibold">
                {selectedAuctions.length} Items Selected
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setBulkStatusTarget("active");
                  }}
                  disabled={isBulkProcessing}
                  className="font-medium text-xs h-9"
                >
                  Mark Active
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setBulkStatusTarget("unsold");
                  }}
                  disabled={isBulkProcessing}
                  variant="outline"
                  className="font-medium text-xs h-9"
                >
                  End Unsold
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    clearSelection();
                  }}
                  disabled={isBulkProcessing}
                  variant="ghost"
                  className="font-medium text-xs h-9"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      isPartiallySelected ? "indeterminate" : isAllSelected
                    }
                    onCheckedChange={(checked) => {
                      handleSelectAll(filteredAuctions, checked === true);
                    }}
                  />
                </TableHead>
                <TableHead className="text-xs font-medium py-4">
                  Status
                </TableHead>
                <TableHead className="text-xs font-medium py-4">
                  Auction Details
                </TableHead>
                <TableHead className="text-xs font-medium py-4">
                  Price (Current/Res)
                </TableHead>
                <TableHead className="text-xs font-medium py-4">Ends</TableHead>
                <TableHead className="text-right text-xs font-medium py-4 pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAuctions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted-foreground italic font-medium"
                  >
                    No auctions found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAuctions.map((a) => (
                  <TableRow
                    key={a._id}
                    className="group hover:bg-muted/20 transition-colors"
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedAuctions.includes(a._id)}
                        onCheckedChange={(checked) => {
                          handleToggleSelection(a._id, checked as boolean);
                        }}
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(a.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                          {a.title}
                        </p>
                        <div className="text-xs font-medium text-muted-foreground flex gap-1 items-center">
                          <Badge
                            variant="outline"
                            className="text-[8px] h-4 py-0 px-1 border-primary/20 text-primary bg-primary/5"
                          >
                            {a.categoryName ?? "Uncategorized"}
                          </Badge>
                          <span>{a.make}</span>
                          <span>{a.model}</span>
                          <span>•</span>
                          <span>{a.year}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs font-bold font-mono">
                        <span className="text-green-600">
                          {formatCurrency(a.currentPrice)}
                        </span>
                        <span className="text-muted-foreground/60 text-[10px]">
                          {formatCurrency(a.reservePrice)} (Res)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {a.endTime
                          ? new Date(a.endTime).toLocaleDateString()
                          : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 rounded-md p-2 border"
                        >
                          <DropdownMenuItem
                            onClick={() => navigate(`/auction/${a._id}`)}
                            className="rounded-lg font-bold gap-2"
                          >
                            <Eye className="h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive font-bold rounded-lg gap-2"
                            disabled={a.status !== "active"}
                            onClick={() => {
                              if (a.status === "active") handleForceEnd(a);
                            }}
                          >
                            <AlertCircle className="h-4 w-4" /> Force End
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {auctionsStatus === "CanLoadMore" && (
            <div className="p-4 border-t bg-muted/20 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadMoreAuctions(50);
                }}
                className="font-medium text-xs border"
              >
                Load More
              </Button>
            </div>
          )}
        </Card>
      </div>
      <BulkActionDialog
        isOpen={!!bulkStatusTarget}
        onClose={() => {
          setBulkStatusTarget(null);
        }}
        onConfirm={() => {
          void handleBulkStatusUpdate();
        }}
        isProcessing={isBulkProcessing}
        selectedCount={selectedAuctions.length}
        targetStatus={bulkStatusTarget}
      />
      <AlertDialog
        open={!!closingAuction}
        onOpenChange={(open) => {
          if (isClosing) return;
          if (!open) setClosingAuction(null);
        }}
      >
        <AlertDialogContent className="rounded-md border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-semibold">
              Close Auction Early?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="font-medium text-sm">
                {closingAuction && (
                  <div className="space-y-3 mt-2">
                    <div className="font-bold text-foreground">
                      {closingAuction.title}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          Current Bid:
                        </span>
                        <div className="font-bold text-primary">
                          {formatCurrency(closingAuction.currentPrice)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Reserve:</span>
                        <div className="font-bold">
                          {formatCurrency(closingAuction.reservePrice)}{" "}
                          {closingAuction.currentPrice >=
                          closingAuction.reservePrice ? (
                            <span className="text-green-600">✓ Met</span>
                          ) : (
                            <span className="text-red-600">✗ Not Met</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {closingAuction.endTime && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">
                          Time Remaining:
                        </span>{" "}
                        <span className="font-bold">
                          {formatTimeRemaining(closingAuction.endTime)}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t text-yellow-600 text-sm font-medium">
                      ⚠️ This action will immediately close the auction. If the
                      reserve price is met, the highest bidder will be awarded
                      the item. If not met, the auction will be marked as
                      unsold.
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-md border font-medium text-xs"
              disabled={isClosing}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseAuction}
              disabled={isClosing}
              className="rounded-md bg-destructive text-destructive-foreground font-semibold text-xs"
            >
              {isClosing ? (
                <LoadingIndicator size="sm" className="mr-2" />
              ) : null}
              Close Auction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
