import { useState, useMemo } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";
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
  Clock,
  MoreVertical,
  Eye,
  Hammer,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { BulkActionDialog } from "./AdminDialogs";
import type { Id, Doc } from "convex/_generated/dataModel";

export default function AdminAuctions() {
  const navigate = useNavigate();
  const adminStats = useQuery(api.admin.getAdminStats);
  const [auctionSearch, setAuctionSearch] = useState("");
  const [selectedAuctions, setSelectedAuctions] = useState<Id<"auctions">[]>(
    []
  );
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<
    "active" | "rejected" | "sold" | "unsold" | null
  >(null);

  const {
    results: allAuctions,
    status: auctionsStatus,
    loadMore: loadMoreAuctions,
  } = usePaginatedQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    api.auctions.getAllAuctions as any,
    {},
    { initialNumItems: 50 }
  );

  const bulkUpdateAuctionsMutation = useMutation(
    api.auctions.bulkUpdateAuctions
  );

  const filteredAuctions = useMemo(() => {
    if (!allAuctions) return [];
    return (allAuctions as Doc<"auctions">[]).filter(
      (a) =>
        a.title.toLowerCase().includes(auctionSearch.toLowerCase()) ||
        a.make.toLowerCase().includes(auctionSearch.toLowerCase()) ||
        a.model.toLowerCase().includes(auctionSearch.toLowerCase())
    );
  }, [allAuctions, auctionSearch]);

  const { isAllSelected, isPartiallySelected } = useMemo(() => {
    const selectedSet = new Set(selectedAuctions);
    const visibleSelectedCount = filteredAuctions.filter((a) =>
      selectedSet.has(a._id)
    ).length;

    return {
      isAllSelected:
        filteredAuctions.length > 0 &&
        visibleSelectedCount === filteredAuctions.length,
      isPartiallySelected:
        visibleSelectedCount > 0 &&
        visibleSelectedCount < filteredAuctions.length,
    };
  }, [selectedAuctions, filteredAuctions]);

  const handleBulkStatusUpdate = async () => {
    if (selectedAuctions.length === 0 || !bulkStatusTarget) return;
    setIsBulkProcessing(true);
    try {
      await bulkUpdateAuctionsMutation({
        auctionIds: selectedAuctions,
        updates: { status: bulkStatusTarget },
      });
      toast.success(
        `Updated ${selectedAuctions.length} auctions to ${bulkStatusTarget}`
      );
      setSelectedAuctions([]);
      setBulkStatusTarget(null);
    } catch (err) {
      console.error("Bulk update failed:", err);
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-500 border-green-500/20 font-bold uppercase text-[10px]">
            Active
          </Badge>
        );
      case "pending_review":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 font-bold uppercase text-[10px]">
            Pending
          </Badge>
        );
      case "sold":
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-bold uppercase text-[10px]">
            Sold
          </Badge>
        );
      case "unsold":
        return (
          <Badge className="bg-muted text-muted-foreground font-bold uppercase text-[10px]">
            Unsold
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="destructive"
            className="font-bold uppercase text-[10px]"
          >
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (allAuctions === undefined || adminStats === undefined) {
    return (
      <AdminLayout stats={adminStats || null}>
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout stats={adminStats}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4">
          <div className="flex items-center gap-2">
            <Hammer className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-black uppercase tracking-tight">
              Marketplace Management
            </h2>
            <Badge variant="secondary" className="ml-2">
              {allAuctions.length} Total
            </Badge>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative group flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search Auctions..."
                className="pl-10 h-10 border-2 rounded-xl bg-muted/30 focus:ring-primary/20"
                value={auctionSearch}
                onChange={(e) => setAuctionSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 border-2 rounded-xl opacity-50 cursor-not-allowed"
              disabled
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="border-2 overflow-hidden bg-card/50 backdrop-blur-sm">
          {selectedAuctions.length > 0 && (
            <div className="bg-primary/10 border-b-2 p-4 flex items-center justify-between animate-in slide-in-from-top-4">
              <p className="text-sm font-black uppercase tracking-tight">
                {selectedAuctions.length} Items Selected
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => setBulkStatusTarget("active")}
                  disabled={isBulkProcessing}
                  className="font-bold uppercase text-xs h-9"
                >
                  Mark Active
                </Button>
                <Button
                  size="sm"
                  onClick={() => setBulkStatusTarget("unsold")}
                  disabled={isBulkProcessing}
                  variant="outline"
                  className="font-bold uppercase text-xs h-9"
                >
                  End Unsold
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSelectedAuctions([])}
                  disabled={isBulkProcessing}
                  variant="ghost"
                  className="font-bold uppercase text-xs h-9"
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
                      if (checked === true) {
                        const visibleIds = filteredAuctions.map((a) => a._id);
                        setSelectedAuctions((prev) =>
                          Array.from(new Set([...prev, ...visibleIds]))
                        );
                      } else {
                        const visibleIds = new Set(
                          filteredAuctions.map((a) => a._id)
                        );
                        setSelectedAuctions((prev) =>
                          prev.filter((id) => !visibleIds.has(id))
                        );
                      }
                    }}
                  />
                </TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                  Status
                </TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                  Auction Details
                </TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                  Price (Current/Res)
                </TableHead>
                <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                  Ends
                </TableHead>
                <TableHead className="text-right uppercase text-[10px] font-black tracking-widest py-4 pr-6">
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
                          setSelectedAuctions((prev) =>
                            checked === true
                              ? [...prev, a._id]
                              : prev.filter((id) => id !== a._id)
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(a.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                          {a.title}
                        </p>
                        <div className="text-[10px] font-medium text-muted-foreground uppercase flex gap-1">
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
                      <div className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {new Date(a.endTime).toLocaleDateString()}
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
                          className="w-48 rounded-xl p-2 border-2"
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
                            onClick={() =>
                              toast.info(
                                "Force end logic pending implementation"
                              )
                            }
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
                onClick={() => loadMoreAuctions(50)}
                className="font-bold uppercase text-[10px] tracking-widest border-2"
              >
                Load More
              </Button>
            </div>
          )}
        </Card>
      </div>
      <BulkActionDialog
        isOpen={!!bulkStatusTarget}
        onClose={() => setBulkStatusTarget(null)}
        onConfirm={handleBulkStatusUpdate}
        isProcessing={isBulkProcessing}
        selectedCount={selectedAuctions.length}
        targetStatus={bulkStatusTarget}
      />
    </AdminLayout>
  );
}
