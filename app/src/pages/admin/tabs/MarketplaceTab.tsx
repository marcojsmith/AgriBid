// app/src/pages/admin/tabs/MarketplaceTab.tsx
import { TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Clock, MoreVertical, Eye, Hammer, AlertCircle, Search } from "lucide-react";
import { useAdminDashboard } from "../context/useAdminDashboard";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Renders the Marketplace admin "Auctions" tab UI for viewing, selecting, and performing actions on auctions.
 *
 * Displays a selectable table of auctions with per-row status badges, details, pricing, end time, per-item actions, bulk action controls when items are selected, and an optional "Load More Auctions" control.
 *
 * @returns A React element containing the marketplace auctions management user interface.
 */
export function MarketplaceTab() {
  const {
    filteredAuctions,
    selectedAuctions,
    setSelectedAuctions,
    isBulkProcessing,
    setBulkStatusTarget,
    auctionsStatus,
    loadMoreAuctions,
  } = useAdminDashboard();
  const navigate = useNavigate();

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

  const selectedSet = new Set(selectedAuctions);
  const visibleSelectedCount = filteredAuctions.filter(a => selectedSet.has(a._id)).length;
  
  const isAllSelected = filteredAuctions.length > 0 && visibleSelectedCount === filteredAuctions.length;
  const isPartiallySelected = visibleSelectedCount > 0 && visibleSelectedCount < filteredAuctions.length;

  return (
    <TabsContent
      value="auctions"
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
    >
      <Card className="border-2 overflow-hidden bg-card/50">
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
            <TableRow className="border-b-2">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isPartiallySelected ? "indeterminate" : isAllSelected}
                  onCheckedChange={(checked) => {
                    if (checked === true) {
                      setSelectedAuctions(filteredAuctions.map((a) => a._id));
                    } else {
                      setSelectedAuctions([]);
                    }
                  }}
                  aria-label="Select all auctions"
                />
              </TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                Status
              </TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                Title / ID
              </TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                Make & Model
              </TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                Prices (Start/Res/Curr)
              </TableHead>
              <TableHead className="uppercase text-[10px] font-black tracking-widest py-4">
                Ends
              </TableHead>
              <TableHead className="text-right uppercase text-[10px] font-black tracking-widest py-4 pr-6">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAuctions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Search className="h-8 w-8 opacity-20" />
                    <p className="font-bold uppercase text-xs tracking-widest">No auctions found</p>
                    <p className="text-[10px] font-medium">Try adjusting your search filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAuctions.map((a) => (
                <TableRow
                  key={a._id}
                  className="group hover:bg-muted/20 border-b"
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedAuctions.includes(a._id)}
                      onCheckedChange={(checked) => {
                        setSelectedAuctions((prev) =>
                          checked === true
                            ? [...prev, a._id]
                            : prev.filter((id) => id !== a._id),
                        );
                      }}
                      aria-label={`Select auction ${a.title}`}
                    />
                  </TableCell>
                  <TableCell>{getStatusBadge(a.status)}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                        {a.title}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">
                        {a._id}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-black uppercase tracking-tight">
                        {a.make}
                      </span>
                      <span className="mx-1.5 opacity-30">/</span>
                      <span className="text-muted-foreground font-medium">
                        {a.model}
                      </span>
                      <Badge
                        variant="outline"
                        className="ml-2 text-[9px] font-black py-0 px-1.5 h-4 border-2"
                      >
                        {a.year}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-3 text-xs font-bold font-mono">
                      <span
                        title="Starting"
                        className="text-muted-foreground"
                      >
                        R {a.startingPrice.toLocaleString()}
                      </span>
                      <span
                        title="Reserve"
                        className="text-primary border-x px-2"
                      >
                        R {a.reservePrice.toLocaleString()}
                      </span>
                      <span title="Current" className="text-green-600">
                        R {a.currentPrice.toLocaleString()}
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
                          className="h-8 w-8 group-hover:bg-background shadow-none border-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 rounded-xl p-2 border-2"
                      >
                        <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground">
                          Modify Record
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => navigate(`/auction/${a._id}`)}
                          className="rounded-lg font-bold gap-2"
                        >
                          <Eye className="h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-primary focus:text-primary font-bold rounded-lg gap-2"
                          onClick={() =>
                            toast.info("Bidding editor coming soon")
                          }
                        >
                          <Hammer className="h-4 w-4" /> Edit Bidding
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive font-bold rounded-lg gap-2"
                          onClick={() =>
                            toast.info(
                              "Force end logic pending implementation",
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
              Load More Auctions
            </Button>
          </div>
        )}
      </Card>
    </TabsContent>
  );
}