import type { Id } from "convex/_generated/dataModel";

/**
 * Result of a confirm resolve ticket operation.
 */
export interface ConfirmResolveResult {
  success: boolean;
  error?: string;
}

/**
 * Arguments for confirming ticket resolution.
 */
export interface ConfirmResolveTicketArgs {
  ticketId: Id<"supportTickets">;
  resolutionText: string;
  onResolveStart: (ticketId: Id<"supportTickets">) => void;
  onResolveEnd: (ticketId: Id<"supportTickets">) => void;
  resolveTicket: (args: {
    ticketId: Id<"supportTickets">;
    resolution: string;
  }) => Promise<unknown>;
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
}

/**
 * Confirms resolution of a support ticket.
 * Validates the resolution text, calls the mutation, and handles errors.
 *
 * @param args - Confirmation arguments including ticket ID, resolution text, and callbacks
 * @returns Promise<ConfirmResolveResult> indicating success or error
 */
export async function confirmResolveTicket(
  args: ConfirmResolveTicketArgs
): Promise<ConfirmResolveResult> {
  const {
    ticketId,
    resolutionText,
    onResolveStart,
    onResolveEnd,
    resolveTicket,
    toastError,
    toastSuccess,
  } = args;

  const resolution = resolutionText.trim();
  if (!resolution) {
    toastError("Please provide a resolution message");
    return { success: false, error: "No resolution message provided" };
  }

  onResolveStart(ticketId);
  try {
    await resolveTicket({ ticketId, resolution });
    toastSuccess("Ticket resolved");
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to resolve ticket";
    toastError(message);
    return { success: false, error: message };
  } finally {
    onResolveEnd(ticketId);
  }
}
