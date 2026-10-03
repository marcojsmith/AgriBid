import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCcw,
  Bug,
  ExternalLink,
} from "lucide-react";

import { AdminLayout } from "@/components/admin/AdminLayout";
import { LoadingIndicator } from "@/components/LoadingIndicator";

type ErrorStatus = "pending" | "processing" | "completed" | "failed";

interface StatusConfig {
  label: string;
  icon: typeof AlertTriangle;
  color: string;
}

interface ErrorReport {
  _id: string;
  _creationTime: number;
  fingerprint: string;
  status: ErrorStatus;
  errorType: string;
  errorMessage: string;
  userId?: string;
  userRole?: string;
  instanceCount: number;
  lastOccurredAt: number;
  githubIssueUrl?: string;
  githubIssueNumber?: number;
}

const STATUS_CONFIG: Record<ErrorStatus, StatusConfig> = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-warning bg-warning/10",
  },
  processing: {
    label: "Processing",
    icon: RefreshCcw,
    color: "text-primary bg-primary/10",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "text-success bg-success/10",
  },
  failed: {
    label: "Failed",
    icon: AlertTriangle,
    color: "text-destructive bg-destructive/10",
  },
};

/**
 * Renders the Error Reports admin dashboard.
 *
 * Displays statistics about error reports and a table of recent reports
 * with their status, type, message, and GitHub issue links.
 *
 * @returns The AdminErrorReports page component.
 */
export default function AdminErrorReports() {
  const [statusFilter, setStatusFilter] = useState<ErrorStatus | "all">("all");

  const stats = useQuery(api.admin.getErrorReportStats);
  const reports = useQuery(api.admin.getErrorReports, {
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 50,
  });

  if (stats === undefined || reports === undefined) {
    return (
      <AdminLayout
        title="Error Reports"
        subtitle="Monitor and manage automatic error reports"
      >
        <div className="h-64 flex items-center justify-center">
          <LoadingIndicator />
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    {
      label: "Pending",
      count: stats.pending,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Processing",
      count: stats.processing,
      icon: RefreshCcw,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Completed",
      count: stats.completed,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Failed",
      count: stats.failed,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Total",
      count: stats.total,
      icon: Bug,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
  ];

  return (
    <AdminLayout
      title="Error Reports"
      subtitle="Monitor and manage automatic error reports"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="bg-card rounded-md border border-border p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {card.count}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {card.label}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-md border border-border">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                }}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  statusFilter === "all"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                All
              </button>
              {(
                Object.entries(STATUS_CONFIG) as [ErrorStatus, StatusConfig][]
              ).map(([status, config]) => {
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setStatusFilter(status);
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
                      statusFilter === status
                        ? `${config.color} bg-opacity-20`
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <config.icon className="h-3.5 w-3.5" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Error Message
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Instances
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Last Occurred
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    GitHub Issue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.reports.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No error reports found
                    </td>
                  </tr>
                ) : (
                  reports.reports.map((report: ErrorReport) => {
                    const statusConfig = STATUS_CONFIG[report.status] as
                      | StatusConfig
                      | undefined;
                    const config = statusConfig ?? STATUS_CONFIG.pending;
                    return (
                      <tr
                        key={report._id}
                        className="hover:bg-muted/50"
                      >
                        <td className="px-4 py-3">
                          <div
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
                          >
                            <config.icon className="h-3 w-3" />
                            {config.label}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {report.errorType}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate text-foreground">
                            {report.errorMessage}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {report.instanceCount > 1 && (
                            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                              {report.instanceCount}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(report.lastOccurredAt).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {report.githubIssueUrl ? (
                            <a
                              href={report.githubIssueUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              #{report.githubIssueNumber}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground/50">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
