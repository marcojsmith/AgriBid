import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

export function SupportTab() {
  const tickets = useQuery(api.admin.getTickets, {});
  const resolveTicket = useMutation(api.admin.resolveTicket);

  const handleResolve = async (ticketId: Id<"supportTickets">) => {
    try {
        await resolveTicket({ ticketId, resolution: "Admin marked as resolved" });
        toast.success("Ticket resolved");
    } catch (e) {
        toast.error("Failed to resolve ticket");
    }
  };

  if (!tickets) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary/40" /></div>;
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
            {tickets.map((ticket) => (
              <TableRow key={ticket._id}>
                <TableCell>
                    <Badge variant={ticket.status === "open" ? "destructive" : "outline"}>
                        {ticket.status}
                    </Badge>
                </TableCell>
                <TableCell className="font-medium">{ticket.subject}</TableCell>
                <TableCell className="max-w-[300px] truncate">{ticket.message}</TableCell>
                <TableCell className="uppercase text-xs font-bold">{ticket.priority}</TableCell>
                <TableCell className="text-right">
                    {ticket.status === "open" && (
                        <Button size="sm" onClick={() => handleResolve(ticket._id)}>
                            <Check className="h-4 w-4 mr-2" /> Resolve
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
