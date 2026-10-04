/**
 * Error fingerprinting and validation detection helpers.
 *
 * Fingerprinting enables deduplication of error reports.
 */

const SERVER_VALIDATION_PATTERNS = [
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
 * Generate a deterministic fingerprint for an error to enable deduplication.
 *
 * @param errorType - The error type/name (e.g., "TypeError")
 * @param message - The error message (will be normalized)
 * @param stackTrace - Optional stack trace to extract top frame from
 * @returns A deterministic fingerprint string
 */
export function generateFingerprint(
  errorType: string,
  message: string,
  stackTrace?: string | null
): string {
  const normalizedMessage = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);

  let topFrame = "";
  if (stackTrace) {
    const lines = stackTrace.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed !== "" && trimmed.startsWith("at ")) {
        // Safe from catastrophic backtracking: the lazy groups have no nested
        // quantifiers and input is a single stack-frame line, so backtracking
        // is at worst quadratic in the line length.
        // eslint-disable-next-line security/detect-unsafe-regex
        const match = /at\s+(?:(.+?)\s+\()?(.*?)\)?$/.exec(trimmed);
        if (match) {
          topFrame = match[1] || match[2];
          break;
        }
      }
    }
  }

  return `${errorType}:${normalizedMessage}:${topFrame}`;
}

/**
 * Check if an error is a validation error server-side.
 *
 * @param errorMessage - The error message to check
 * @returns True if the error is a validation error
 */
export function isServerValidationError(errorMessage: string): boolean {
  for (const pattern of SERVER_VALIDATION_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return true;
    }
  }
  return false;
}
