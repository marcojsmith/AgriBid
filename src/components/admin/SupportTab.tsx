import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Check, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { confirmResolveTicket } from "./confirmResolveTicket";

/**
 * Render the admin Support tab that lists support tickets and provides a UI to resolve open tickets.
 *
 * @returns A React element showing a centered loading indicator while tickets are loading, or a table of tickets with per-ticket status, subject, message, priority, and controls to open a resolution dialog for open tickets.
 */
export function SupportTab() {
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const ticketsResult = useQuery(api.admin.getTickets, {
    paginationOpts: { numItems: 50, cursor: currentCursor },
  });
  const resolveTicket = useMutation(api.admin.resolveTicket);
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [selectedTicketId, setSelectedTicketId] =
    useState<Id<"supportTickets"> | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const tickets = ticketsResult?.page ?? [];

  const handleNext = () => {
    if (ticketsResult?.continueCursor) {
      setCursorStack([...cursorStack, currentCursor]);
      setCurrentCursor(ticketsResult.continueCursor);
    }
  };

  const handlePrevious = () => {
    if (cursorStack.length > 0) {
      const newStack = [...cursorStack];
      const previousCursor = newStack.pop();
      setCursorStack(newStack);
      setCurrentCursor(previousCursor ?? null);
    }
  };

  const handleResolve = (ticketId: Id<"supportTickets">) => {
    setSelectedTicketId(ticketId);
    setResolutionText("");
  };

  const confirmResolve = async () => {
    if (!selectedTicketId) return;

    await confirmResolveTicket({
      ticketId: selectedTicketId,
      resolutionText,
      onResolveStart: (ticketId) =>
        setResolvingIds((prev) => new Set(prev).add(ticketId)),
      onResolveEnd: (ticketId) =>
        setResolvingIds((prev) => {
          const next = new Set(prev);
          next.delete(ticketId);
          return next;
        }),
      resolveTicket,
      toastError: (message) => toast.error(message),
      toastSuccess: (message) => {
        toast.success(message);
        setSelectedTicketId(null);
      },
    });
  };

  if (ticketsResult === undefined) {
    return (
      <div className="flex justify-center p-8">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <Card className="border-2 overflow-hidden bg-card/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 opacity-20" />
                    <p className="font-black uppercase text-xs tracking-widest">
                      No support tickets
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow key={ticket._id}>
                  <TableCell>
                    <Badge
                      variant={
                        ticket.status === "open" ? "destructive" : "outline"
                      }
                    >
                      {ticket.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {ticket.subject}
                  </TableCell>
                  <TableCell className="truncate">{ticket.message}</TableCell>
                  <TableCell className="uppercase text-xs font-bold">
                    {ticket.priority}
                  </TableCell>
                  <TableCell className="text-right">
                    {ticket.status === "open" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          handleResolve(ticket._id);
                        }}
                        disabled={resolvingIds.has(ticket._id)}
                      >
                        {resolvingIds.has(ticket._id) ? (
                          <LoadingIndicator size="sm" className="mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Resolve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {tickets.length > 0 && (
          <div className="p-4 border-t bg-muted/20 flex justify-between items-center">
            <p className="text-[10px] font-black uppercase text-muted-foreground">
              Showing {tickets.length} tickets
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 font-bold text-[10px] uppercase gap-1"
                onClick={handlePrevious}
                disabled={cursorStack.length === 0}
              >
                <ChevronLeft className="h-3 w-3" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 font-bold text-[10px] uppercase gap-1"
                onClick={handleNext}
                disabled={ticketsResult?.isDone ?? true}
              >
                Next <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog
        open={!!selectedTicketId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicketId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Support Ticket</DialogTitle>
            <DialogDescription>
              Please provide a brief explanation of how this ticket was
              resolved. This will be recorded in the audit logs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution Details</Label>
              <Textarea
                id="resolution"
                placeholder="Describe the resolution..."
                value={resolutionText}
                onChange={(e) => {
                  setResolutionText(e.target.value);
                }}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTicketId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmResolve}
              disabled={
                !resolutionText.trim() ||
                (selectedTicketId ? resolvingIds.has(selectedTicketId) : false)
              }
            >
              {selectedTicketId && resolvingIds.has(selectedTicketId) && (
                <LoadingIndicator size="sm" className="mr-2" />
              )}
              Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
