import { useState } from "react";
import { useQuery } from "convex/react";
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
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { Button } from "@/components/ui/button";

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
  const [limit, setLimit] = useState(50);
  const logs = useQuery(api.admin.getAuditLogs, { limit: limit + 1 });

  if (!logs) {
    return (
      <div className="flex justify-center p-8">
        <LoadingIndicator />
      </div>
    );
  }

  const hasMore = logs.length > limit;
  const displayLogs = logs.slice(0, limit);

  const formatDetails = (details?: string) => {
    if (!details) return "—";
    try {
      const parsed = JSON.parse(details);
      return (
        <details className="cursor-pointer">
          <summary className="text-[10px] text-primary hover:underline font-bold uppercase tracking-tighter">
            View Payload
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded-lg text-[10px] font-mono overflow-x-auto whitespace-pre-wrap w-full">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </details>
      );
    } catch {
      return details;
    }
  };

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
            {displayLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <FileText className="h-8 w-8 opacity-20" />
                    <p className="font-black uppercase text-xs tracking-widest">
                      No audit logs found
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayLogs.map((log) => (
                <TableRow key={log._id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.adminId.length > 10
                      ? `${log.adminId.substring(0, 10)}...`
                      : log.adminId}
                  </TableCell>
                  <TableCell className="font-bold uppercase text-xs tracking-wider">
                    {log.action}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {log.targetType}: {log.targetId}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDetails(log.details)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {displayLogs.length > 0 && (
          <div className="p-4 border-t bg-muted/20 flex justify-between items-center">
            <p className="text-[10px] font-black uppercase text-muted-foreground">
              Showing latest {displayLogs.length} entries
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 font-bold text-[10px] uppercase gap-1"
                onClick={() => setLimit((prev) => Math.max(50, prev - 50))}
                disabled={limit <= 50}
              >
                <ChevronLeft className="h-3 w-3" /> Less
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 font-bold text-[10px] uppercase gap-1"
                onClick={() => setLimit((prev) => prev + 50)}
                disabled={!hasMore}
              >
                More <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
