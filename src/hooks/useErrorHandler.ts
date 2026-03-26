/**
 * Custom hook for handling errors in React components.
 *
 * Provides a consistent way to handle errors including showing toast
 * notifications and optionally reporting to GitHub.
 */

import { useCallback } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/utils";
import { reportError } from "@/lib/error-reporter";

interface UseErrorHandlerOptions {
  /** Whether to report unexpected errors to GitHub */
  reportToGitHub?: boolean;
  /** Additional context for error reporting */
  context?: {
    userId?: string;
    userRole?: string;
  };
}

/**
 * Hook for consistent error handling with toast notifications and optional GitHub reporting.
 *
 * @param options - Configuration options
 * @returns Object with handleError function
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { reportToGitHub = true, context } = options;

  const handleError = useCallback(
    async (error: unknown, fallbackMessage?: string) => {
      const message = getErrorMessage(
        error,
        fallbackMessage ?? "An error occurred"
      );
      toast.error(message);

      if (reportToGitHub) {
        const errorObj: Error | string =
          error instanceof Error ? error : message;
        await reportError(errorObj, context);
      }
    },
    [reportToGitHub, context]
  );

  return { handleError };
}
