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

const STATUS_CONFIG: Record<
  ErrorStatus,
  { label: string; icon: typeof AlertTriangle; color: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    color:
      "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
  },
  processing: {
    label: "Processing",
    icon: RefreshCcw,
    color: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color:
      "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30",
  },
  failed: {
    label: "Failed",
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
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
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      label: "Processing",
      count: stats.processing,
      icon: RefreshCcw,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Completed",
      count: stats.completed,
      icon: CheckCircle,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "Failed",
      count: stats.failed,
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/20",
    },
    {
      label: "Total",
      count: stats.total,
      icon: Bug,
      color: "text-gray-600 dark:text-gray-400",
      bg: "bg-gray-50 dark:bg-gray-800",
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
              className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {card.count}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {card.label}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                }}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  statusFilter === "all"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                All
              </button>
              {(Object.keys(STATUS_CONFIG) as ErrorStatus[]).map((status) => {
                const config = STATUS_CONFIG[status];
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
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Error Message
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Instances
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    Last Occurred
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">
                    GitHub Issue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {reports.reports.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      No error reports found
                    </td>
                  </tr>
                ) : (
                  reports.reports.map((report: ErrorReport) => {
                    const config =
                      STATUS_CONFIG[report.status as ErrorStatus] ??
                      STATUS_CONFIG.pending;
                    return (
                      <tr
                        key={report._id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-4 py-3">
                          <div
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
                          >
                            <config.icon className="h-3 w-3" />
                            {config.label}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {report.errorType}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate text-gray-900 dark:text-gray-100">
                            {report.errorMessage}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {report.instanceCount > 1 && (
                            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300">
                              {report.instanceCount}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
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
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              #{report.githubIssueNumber}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600">
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
