import { getBreadcrumbs } from "./activity-tracker";

function sanitize(s?: string) {
  if (!s) return s;
  return s
    .replace(/\b[\w.+-]+@[\w-]+\.[\w-.]+\b/g, "[redacted]")
    .replace(/\b\+?\d[\d\s()-]{6,}\b/g, "[redacted]")
    .replace(/\b[A-Z0-9_-]{6,}\b/g, "[redacted]")
    .slice(0, 2000);
}

interface ErrorReportOptions {
  userContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function prepareErrorReport(error: Error | unknown, opts?: ErrorReportOptions) {
  const e = error instanceof Error ? error : new Error(String(error));
  const breadcrumbs = getBreadcrumbs().map((b) => ({ ...b }));

  const payload = {
    errorType: e.name || "Error",
    message: sanitize(e.message),
    stackTrace: sanitize(e.stack),
    userContext: {
      userId: opts?.userContext?.userId as string | undefined,
      role: opts?.userContext?.role as string | undefined,
      kycStatus: opts?.userContext?.kycStatus as string | undefined,
    },
    breadcrumbs,
    metadata: {
      browser: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      url: typeof location !== "undefined" ? location.href : undefined,
      timestamp: Date.now(),
      ...(opts?.metadata || {}),
    },
  };

  return payload;
}
