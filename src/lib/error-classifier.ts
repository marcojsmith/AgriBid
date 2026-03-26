/**
 * Error classifier to distinguish between validation errors and unexpected errors.
 *
 * Validation errors are user-correctable and don't need to be reported to GitHub.
 * Unexpected errors are system failures that should be captured.
 */

type ErrorClassification = "validation" | "unexpected";

export type { ErrorClassification };

const VALIDATION_PATTERNS = [
  /not authenticated/i,
  /unauthorized/i,
  /forbidden/i,
  /must be logged in/i,
  /is required/i,
  /must be between/i,
  /invalid format/i,
  /cannot bid on own/i,
  /kyc required/i,
  /only .* can perform/i,
  /invalid.*token/i,
  /session.*expired/i,
];

/**
 * Classify an error to determine if it should be reported to GitHub.
 *
 * @param error - The error to classify (Error object or string)
 * @returns "validation" for user-correctable errors, "unexpected" for system errors
 */
export function classifyError(error: Error | string): ErrorClassification {
  const errorMessage = error instanceof Error ? error.message : error;

  if (error instanceof Error) {
    const errorCode = (error as unknown as { code?: string }).code;
    if (errorCode === "VALIDATION_ERROR" || errorCode === "validation") {
      return "validation";
    }
  }

  for (const pattern of VALIDATION_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return "validation";
    }
  }

  return "unexpected";
}

/**
 * Determine if an error should be reported to GitHub.
 *
 * @param error - The error to check (Error object or string)
 * @returns true if the error should be reported, false if it's a validation error
 */
export function shouldReportError(error: Error | string): boolean {
  return classifyError(error) === "unexpected";
}

/**
 * Get a user-friendly classification label.
 *
 * @param error - The error to classify
 * @returns Human-readable classification
 */
export function getErrorClassification(error: Error | string): string {
  return classifyError(error);
}
