import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Check, ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatSastDate } from "@/lib/dates";
import { PROVINCE_LABELS } from "@/lib/provinces";
import { getErrorMessage } from "@/lib/utils";

/**
 * The admin list of "Request a transport quote" submissions: newest first,
 * with a `tel:` link to call each person back and a "Mark handled" button on
 * new requests.
 *
 * @returns A loading indicator while the list loads, then the table
 */
export function TransportQuotesTab() {
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const result = useQuery(api.admin.getTransportQuotes, {
    paginationOpts: { numItems: 50, cursor: currentCursor },
  });
  const markHandled = useMutation(api.admin.markTransportQuoteHandled);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const handleNext = () => {
    if (result?.continueCursor) {
      setCursorStack([...cursorStack, currentCursor]);
      setCurrentCursor(result.continueCursor);
    }
  };

  const handlePrevious = () => {
    if (cursorStack.length > 0) {
      const next = [...cursorStack];
      const previous = next.pop();
      setCursorStack(next);
      setCurrentCursor(previous ?? null);
    }
  };

  const handleMarkHandled = async (requestId: Id<"transportQuoteRequests">) => {
    setBusyIds((prev) => new Set(prev).add(requestId));
    try {
      await markHandled({ requestId });
      toast.success("Marked as handled");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not mark as handled"));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  if (result === undefined) {
    return (
      <div className="flex justify-center p-8">
        <LoadingIndicator />
      </div>
    );
  }

  const rows = result.page;

  return (
    <Card className="overflow-hidden border bg-card/50">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Pickup</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Truck className="h-8 w-8 opacity-20" />
                  <p className="text-xs font-medium">
                    No transport quote requests
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row._id}>
                <TableCell className="whitespace-nowrap">
                  {formatSastDate(row.createdAt)}
                </TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <a
                    href={`tel:${row.phone}`}
                    className="whitespace-nowrap underline underline-offset-2"
                  >
                    {row.phone}
                  </a>
                </TableCell>
                <TableCell>
                  <p>{row.pickup}</p>
                  {row.lotLabel ? (
                    <p className="text-xs text-muted-foreground">
                      {row.lotLabel}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  {row.deliveryTown}, {PROVINCE_LABELS[row.deliveryProvince]}
                </TableCell>
                <TableCell className="max-w-64 whitespace-pre-wrap">
                  {row.notes}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={row.status === "new" ? "destructive" : "outline"}
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {row.status === "new" && (
                    <Button
                      size="sm"
                      disabled={busyIds.has(row._id)}
                      onClick={() => {
                        void handleMarkHandled(row._id);
                      }}
                    >
                      {busyIds.has(row._id) ? (
                        <LoadingIndicator size="sm" className="mr-2" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Mark handled
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {rows.length > 0 && (
        <div className="flex items-center justify-between border-t bg-muted/20 p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Showing {rows.length} of {result.totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-3 text-xs font-medium"
              onClick={handlePrevious}
              disabled={cursorStack.length === 0}
            >
              <ChevronLeft className="h-3 w-3" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 px-3 text-xs font-medium"
              onClick={handleNext}
              disabled={result.isDone}
            >
              Next <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
