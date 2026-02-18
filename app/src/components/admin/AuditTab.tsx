import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

/**
 * Render a table view of admin audit logs with a loading state.
 *
 * Displays a centered spinner while audit logs are being fetched. Once available,
 * shows a card containing a table of logs with columns: Timestamp, Admin ID,
 * Action, Target, and Details.
 *
 * @returns A React element that displays the loading spinner or the audit logs table.
 */
export function AuditTab() {
  const logs = useQuery(api.admin.getAuditLogs, {});

  if (!logs) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <Card className="border-2 overflow-hidden bg-card/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Admin ID</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log._id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{log.adminId.substring(0, 10)}...</TableCell>
                <TableCell className="font-bold uppercase text-xs tracking-wider">{log.action}</TableCell>
                <TableCell className="text-sm font-medium">{log.targetType}: {log.targetId}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{log.details}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}