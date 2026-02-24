import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ConvexError } from "convex/values";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates that a callback URL is a safe relative path.
 * Prevents open redirect vulnerabilities by ensuring the URL starts with '/'
 * and is not a protocol-relative URL (starting with '//').
 *
 * @param url The URL to validate
 * @returns true if the URL is a safe relative path
 */
export function isValidCallbackUrl(
  url: string | null | undefined
): url is string {
  if (!url) return false;
  // Must start with / and not //
  return url.startsWith("/") && !url.startsWith("//");
}

/**
 * Extracts a user-friendly error message from various error types.
 * Safely handles ConvexError by checking if data is a string before returning it.
 *
 * @param error - The error to extract a message from
 * @param fallback - The fallback message if no valid message can be extracted
 * @returns A user-friendly error message string
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = "An error occurred"
): string {
  if (error instanceof ConvexError) {
    if (typeof error.data === "string") {
      return error.data;
    }
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
