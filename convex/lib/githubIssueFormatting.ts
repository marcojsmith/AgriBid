/**
 * GitHub issue body formatting helpers.
 *
 * These functions format error reports into Markdown suitable for
 * GitHub issue bodies and comments.
 */

interface ErrorReportForIssue {
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  userId?: string;
  userRole?: string;
  additionalInfo?: Record<string, string | number>;
  breadcrumbs: {
    timestamp: number;
    type: string;
    description: string;
    metadata?: Record<string, string | number>;
  }[];
  metadata: { url: string; userAgent: string; timestamp: number };
  instanceCount: number;
}

interface ErrorReportForComment {
  errorMessage: string;
  userId?: string;
  metadata: { url: string };
  instanceCount: number;
  lastOccurredAt: number;
}

/**
 * Format an error report as a GitHub issue body.
 *
 * @param report - The error report details
 * @returns Markdown-formatted issue body
 */
export function formatIssueBody(report: ErrorReportForIssue): string {
  const breadcrumbsMd = report.breadcrumbs
    .map((b) => {
      let line = `- **${new Date(b.timestamp).toISOString()}** [${b.type}] ${b.description}`;
      if (b.metadata) {
        const metaStr = Object.entries(b.metadata)
          .map(([k, val]) => `${k}=${String(val)}`)
          .join(", ");
        line += ` \`${metaStr}\``;
      }
      return line;
    })
    .join("\n");

  const additionalInfoMd = report.additionalInfo
    ? Object.entries(report.additionalInfo)
        .map(([k, val]) => `- **${k}:** ${String(val)}`)
        .join("\n")
    : "None";

  // Intentionally `||` not `??`: an empty string user ID/role also means "missing"
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const userIdLabel = report.userId || "Anonymous";
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const userRoleLabel = report.userRole || "N/A";

  return `## Production Error Report

**Error Type:** ${report.errorType}
**Error Message:** ${report.errorMessage}
**Instance Count:** ${String(report.instanceCount)}

### Stack Trace
\`\`\`
${report.stackTrace ?? "No stack trace available"}
\`\`\`

### User Context
- **User ID:** ${userIdLabel}
- **User Role:** ${userRoleLabel}

### Additional Info
${additionalInfoMd}

### Recent Actions (Breadcrumbs)
${breadcrumbsMd || "No breadcrumbs recorded"}

### Environment
- **URL:** ${report.metadata.url}
- **User Agent:** ${report.metadata.userAgent}
- **Timestamp:** ${new Date(report.metadata.timestamp).toISOString()}

---
*Auto-reported from production*`;
}

/**
 * Format an error report update as a GitHub comment body.
 *
 * @param report - The error report details for the comment
 * @returns Markdown-formatted comment body
 */
export function formatCommentBody(report: ErrorReportForComment): string {
  return `## New Error Instance

- **Instance Count:** ${String(report.instanceCount)}
- **User ID:** ${report.userId ?? "Anonymous"}
- **URL:** ${report.metadata.url}
- **Last Occurred:** ${new Date(report.lastOccurredAt).toISOString()}

> ${report.errorMessage}

---
*Additional instance auto-reported from production*`;
}
