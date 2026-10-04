/**
 * Text sanitization helpers for error reporting.
 *
 * These functions redact sensitive patterns (emails, tokens, card numbers)
 * before persisting error reports or posting to GitHub.
 */

const REDACTED_EMAIL = "[redacted-email]";
const REDACTED_TOKEN = "[redacted-token]";
const REDACTED_CARD = "[redacted-card]";

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const JWT_PATTERN =
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g;
const API_KEY_PREFIX_PATTERN =
  /\b(?:sk_live|sk_test|pk_live|pk_test|rk_live|rk_test|ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_-]+\b/g;
const BEARER_TOKEN_PATTERN =
  /\b(?:Bearer|bearer|token|Token|TOKEN)\s+[A-Za-z0-9._~+/=-]{20,}\b/g;
const CARD_PATTERN = /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;

/**
 * Truncate a string to the given max length, appending an ellipsis if truncated.
 *
 * @param str - The string to truncate.
 * @param maxLength - The maximum allowed length.
 * @returns The truncated string, with "..." appended if it was shortened.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Redact common sensitive patterns (emails, tokens, card numbers) from a
 * string before it is persisted or posted to a public GitHub issue.
 *
 * @param value - The raw text to redact
 * @returns The text with sensitive patterns replaced by redaction markers
 */
export function sanitizeText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, REDACTED_EMAIL)
    .replace(JWT_PATTERN, REDACTED_TOKEN)
    .replace(API_KEY_PREFIX_PATTERN, REDACTED_TOKEN)
    .replace(BEARER_TOKEN_PATTERN, REDACTED_TOKEN)
    .replace(CARD_PATTERN, REDACTED_CARD);
}

/**
 * Sanitize string values in an additionalInfo record; numbers pass through.
 *
 * @param additionalInfo - Optional record of extra context values
 * @returns The record with each string value redacted
 */
export function sanitizeAdditionalInfo(
  additionalInfo: Record<string, string | number> | undefined
): Record<string, string | number> | undefined {
  if (!additionalInfo) {
    return additionalInfo;
  }
  return Object.fromEntries(
    Object.entries(additionalInfo).map(([key, value]) => [
      key,
      typeof value === "string" ? sanitizeText(value) : value,
    ])
  );
}

interface BreadcrumbWithMetadata {
  timestamp: number;
  type: string;
  description: string;
  metadata?: Record<string, string | number>;
}

/**
 * Sanitize breadcrumb metadata to only include safe keys.
 *
 * @param breadcrumb - Breadcrumb with optional metadata
 * @returns Breadcrumb with sanitized metadata
 */
export function sanitizeBreadcrumbMetadata(
  breadcrumb: BreadcrumbWithMetadata
): BreadcrumbWithMetadata {
  if (!breadcrumb.metadata) {
    return breadcrumb;
  }
  const sanitizedEntries: [string, string | number][] = [];
  for (const key of ["action", "path", "component", "props"] as const) {
    const { [key]: value } = breadcrumb.metadata;
    if (typeof value === "string" || typeof value === "number") {
      sanitizedEntries.push([key, value]);
    }
  }
  return {
    ...breadcrumb,
    metadata:
      sanitizedEntries.length > 0
        ? Object.fromEntries(sanitizedEntries)
        : undefined,
  };
}
