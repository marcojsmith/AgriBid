import { useCallback } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { prepareErrorReport } from "../lib/error-reporter";
import { shouldReportError } from "../lib/error-classifier";

interface ErrorHandlerOptions {
  userContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  silent?: boolean;
}

export default function useErrorHandler() {
  const submit = useMutation(api.errors.submitErrorReport);

  const handleError = useCallback(
    async (error: unknown, opts?: ErrorHandlerOptions) => {
      try {
        const err = error instanceof Error ? error : new Error(String(error));
        // always show toast for user-facing feedback unless silent
        if (!opts?.silent) {
          toast.error(err.message || "An error occurred");
        }

        if (!shouldReportError(err)) return;

        const payload = prepareErrorReport(err, { userContext: opts?.userContext, metadata: opts?.metadata });

        // Fire-and-forget; don't let reporting block UX
        try {
          await submit(payload as never);
        } catch (reportErr) {
          // swallow reporting errors
          console.warn("Error report failed:", reportErr);
        }
      } catch (e) {
        console.error("useErrorHandler internal failure:", e);
      }
    },
    [submit],
  );

  return handleError;
}
