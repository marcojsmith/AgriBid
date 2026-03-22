import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import { confirmResolveTicket } from "./confirmResolveTicket";

describe("confirmResolveTicket", () => {
  const mockTicketId = "ticket123" as Id<"supportTickets">;
  const mockResolution = "Issue has been fixed";

  let mockOnResolveStart: (id: Id<"supportTickets">) => void;
  let mockOnResolveEnd: (id: Id<"supportTickets">) => void;
  let mockResolveTicket: (args: {
    ticketId: Id<"supportTickets">;
    resolution: string;
  }) => Promise<unknown>;
  let mockToastError: (message: string) => void;
  let mockToastSuccess: (message: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnResolveStart = vi.fn();
    mockOnResolveEnd = vi.fn();
    mockResolveTicket = vi.fn().mockResolvedValue(undefined);
    mockToastError = vi.fn();
    mockToastSuccess = vi.fn();
  });

  const createArgs = () => ({
    ticketId: mockTicketId,
    resolutionText: mockResolution,
    onResolveStart: mockOnResolveStart,
    onResolveEnd: mockOnResolveEnd,
    resolveTicket: mockResolveTicket,
    toastError: mockToastError,
    toastSuccess: mockToastSuccess,
  });

  it("should resolve ticket successfully", async () => {
    const result = await confirmResolveTicket(createArgs());

    expect(result.success).toBe(true);
    expect(mockOnResolveStart).toHaveBeenCalledWith(mockTicketId);
    expect(mockResolveTicket).toHaveBeenCalledWith({
      ticketId: mockTicketId,
      resolution: mockResolution,
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Ticket resolved");
    expect(mockOnResolveEnd).toHaveBeenCalledWith(mockTicketId);
  });

  it("should trim resolution text before submitting", async () => {
    const args = createArgs();
    args.resolutionText = "  Fixed the issue  ";

    await confirmResolveTicket(args);

    expect(mockResolveTicket).toHaveBeenCalledWith({
      ticketId: mockTicketId,
      resolution: "Fixed the issue",
    });
  });

  it("should return error when resolution text is empty", async () => {
    const args = createArgs();
    args.resolutionText = "";

    const result = await confirmResolveTicket(args);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No resolution message provided");
    expect(mockToastError).toHaveBeenCalledWith(
      "Please provide a resolution message"
    );
    expect(mockResolveTicket).not.toHaveBeenCalled();
  });

  it("should return error when resolution text is only whitespace", async () => {
    const args = createArgs();
    args.resolutionText = "   \n\t  ";

    const result = await confirmResolveTicket(args);

    expect(result.success).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith(
      "Please provide a resolution message"
    );
    expect(mockResolveTicket).not.toHaveBeenCalled();
  });

  it("should call onResolveStart and onResolveEnd even on error", async () => {
    const args = createArgs();
    args.resolveTicket = vi.fn().mockRejectedValue(new Error("Server error"));

    const result = await confirmResolveTicket(args);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Server error");
    expect(mockOnResolveStart).toHaveBeenCalledWith(mockTicketId);
    expect(mockOnResolveEnd).toHaveBeenCalledWith(mockTicketId);
  });

  it("should handle non-Error thrown by resolveTicket", async () => {
    const args = createArgs();
    args.resolveTicket = vi.fn().mockRejectedValue("Generic error string");

    const result = await confirmResolveTicket(args);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to resolve ticket");
    expect(mockToastError).toHaveBeenCalledWith("Failed to resolve ticket");
  });

  it("should handle null error from resolveTicket", async () => {
    const args = createArgs();
    args.resolveTicket = vi.fn().mockRejectedValue(null);

    const result = await confirmResolveTicket(args);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to resolve ticket");
    expect(mockToastError).toHaveBeenCalledWith("Failed to resolve ticket");
  });

  it("should handle Error with message from resolveTicket", async () => {
    const args = createArgs();
    const error = new Error("Database connection failed");
    args.resolveTicket = vi.fn().mockRejectedValue(error);

    const result = await confirmResolveTicket(args);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Database connection failed");
    expect(mockToastError).toHaveBeenCalledWith("Database connection failed");
  });

  it("should call toastError with default message for unknown errors", async () => {
    const args = createArgs();
    const error = new Error("Unknown error");
    args.resolveTicket = vi.fn().mockRejectedValue(error);
    args.toastError = vi.fn();

    const result = await confirmResolveTicket(args);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unknown error");
  });

  it("should handle null error from resolveTicket", async () => {
    const args = createArgs();
    args.resolveTicket = vi.fn().mockRejectedValue(null);

    const result = await confirmResolveTicket(args);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to resolve ticket");
    expect(mockToastError).toHaveBeenCalledWith("Failed to resolve ticket");
  });

  it("should call onResolveEnd even when resolveTicket throws", async () => {
    const args = createArgs();
    args.resolveTicket = vi.fn().mockRejectedValue(new Error("Network error"));

    await confirmResolveTicket(args);

    expect(mockOnResolveEnd).toHaveBeenCalledWith(mockTicketId);
  });

  it("should call onResolveStart before resolveTicket", async () => {
    const callOrder: string[] = [];
    const args = createArgs();
    args.onResolveStart = vi.fn(() => callOrder.push("start"));
    args.resolveTicket = vi.fn().mockImplementation(() => {
      callOrder.push("resolve");
      return Promise.resolve();
    });

    await confirmResolveTicket(args);

    expect(callOrder).toEqual(["start", "resolve"]);
  });

  it("should not call resolveTicket when resolution is empty", async () => {
    const args = createArgs();
    args.resolutionText = "";

    await confirmResolveTicket(args);

    expect(mockResolveTicket).not.toHaveBeenCalled();
  });
});
