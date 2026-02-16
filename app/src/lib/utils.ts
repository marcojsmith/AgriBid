import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates that a callback URL is a safe relative path.
 * Prevents open redirect vulnerabilities by ensuring the URL starts with '/' 
 * and is not a protocol-relative URL (starting with '//').
 * 
 * @param url The URL to validate
 * @returns true if the URL is a safe relative path
 */
export function isValidCallbackUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  // Must start with / and not //
  return url.startsWith('/') && !url.startsWith('//');
}

