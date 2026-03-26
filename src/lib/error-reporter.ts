/**
 * Error reporter service for capturing and reporting errors to GitHub.
 *
 * This service integrates the activity tracker and error classifier to
 * provide comprehensive error reporting with user context.
 */

import { ConvexHttpClient } from "convex/browser";

import { api } from "../../convex/_generated/api";
import { getBreadcrumbs, trackAction } from "./activity-tracker";
import { shouldReportError } from "./error-classifier";
import { getErrorMessage } from "./utils";

const EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const PHONE_REGEX = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10}\b/g;
const ID_REGEX = /\b\d{6,}\b/g;

const ALLOWED_ADDITIONAL_INFO_KEYS = [
  "component",
  "action",
  "userAction",
  "additionalDetails",
];

/**
 * Sanitize a string by removing potential PII.
 *
 * @param str - The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(str: string): string {
  let sanitized = str;
  sanitized = sanitized.replace(EMAIL_REGEX, "[EMAIL REDACTED]");
  sanitized = sanitized.replace(PHONE_REGEX, "[PHONE REDACTED]");
  sanitized = sanitized.replace(ID_REGEX, "[ID REDACTED]");
  return sanitized;
}

/**
 * Sanitize additional info by filtering to allowed keys and sanitizing values.
 *
 * @param additionalInfo - The additional info object to sanitize
 * @returns Sanitized object with only allowed keys
 */
function sanitizeAdditionalInfo(
  additionalInfo?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!additionalInfo) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const key of ALLOWED_ADDITIONAL_INFO_KEYS) {
    if (additionalInfo[key] !== undefined) {
      const value = additionalInfo[key];
      if (typeof value === "string") {
        sanitized[key] = sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

interface ErrorReportContext {
  userId?: string;
  userRole?: string;
  additionalInfo?: Record<string, unknown>;
}

/**
 * Report an error to the backend for GitHub issue creation.
 * Uses ConvexHttpClient to call the backend mutation.
 *
 * @param error - The error to report (Error object or string)
 * @param context - Optional context about the error
 * @returns Promise that resolves when the error is reported
 */
export async function reportError(
  error: Error | string,
  context?: ErrorReportContext
): Promise<boolean> {
  if (!shouldReportError(error)) {
    return false;
  }

  try {
    const convexUrl = import.meta.env.VITE_CONVEX_URL;
    if (!convexUrl) {
      console.warn("Convex URL not configured, cannot report error");
      return false;
    }

    const client = new ConvexHttpClient(convexUrl);

    const args = {
      errorType: error instanceof Error ? error.name : "Error",
      errorMessage: sanitizeString(
        getErrorMessage(
          error,
          typeof error === "string" ? error : "Unknown Error"
        )
      ),
      stackTrace:
        error instanceof Error ? sanitizeString(error.stack ?? "") : undefined,
      userId: context?.userId,
      userRole: context?.userRole,
      breadcrumbs: getBreadcrumbs().map((b) => ({
        ...b,
        description: sanitizeString(b.description),
      })),
      metadata: {
        url: sanitizeString(
          typeof window !== "undefined" ? window.location.href : "unknown"
        ),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        timestamp: Date.now(),
        ...sanitizeAdditionalInfo(context?.additionalInfo),
      },
    };

    const result = await client.mutation(api.errors.submitErrorReport, args);
    return result.success;
  } catch (err) {
    console.error("error in reportError:", err);
    return false;
  }
}

/**
 * Report an error without awaiting (fire-and-forget).
 * Use this for error boundary handlers where you don't want to block.
 *
 * @param error - The error to report
 * @param context - Optional context
 */
export function reportErrorAsync(
  error: Error | string,
  context?: ErrorReportContext
): void {
  void reportError(error, context);
}

/**
 * Track an action and optionally report an error.
 *
 * @param type - Action type
 * @param description - Action description
 * @param error - Optional error to report after tracking
 * @param context - Optional context for error reporting
 */
export function trackAndReport(
  type: "navigation" | "interaction" | "mutation" | "custom",
  description: string,
  error?: Error | string,
  context?: ErrorReportContext
): void {
  trackAction(type, description);

  if (error) {
    void reportError(error, context);
  }
}
