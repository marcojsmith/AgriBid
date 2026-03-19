import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import { SupportTab } from "./SupportTab";

const mockTickets = [
  {
    _id: "ticket-1" as Id<"supportTickets">,
    status: "open",
    subject: "Can't login",
    message: "I can't login to my account",
    priority: "high",
  },
  {
    _id: "ticket-2" as Id<"supportTickets">,
    status: "resolved",
    subject: "Password reset",
    message: "I need to reset my password",
    priority: "medium",
  },
];

const mockPaginatedTickets = {
  page: mockTickets,
  isDone: true,
  continueCursor: "",
  totalCount: mockTickets.length,
  pageStatus: null,
  splitCursor: null,
};

const { mockUseQuery, mockUseMutation, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockUseQuery: vi.fn(),
    mockUseMutation: vi.fn(() => vi.fn()),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

describe("SupportTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(mockPaginatedTickets);
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it("renders tickets table with data", () => {
    mockUseQuery.mockReturnValue(mockPaginatedTickets);
    render(<SupportTab />);
    expect(screen.getByText("Can't login")).toBeInTheDocument();
    expect(screen.getByText("Password reset")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<SupportTab />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders empty state when no tickets", () => {
    mockUseQuery.mockReturnValue({
      ...mockPaginatedTickets,
      page: [],
      totalCount: 0,
    });
    render(<SupportTab />);
    expect(screen.getByText("No support tickets")).toBeInTheDocument();
  });

  it("renders open ticket with resolve button", () => {
    mockUseQuery.mockReturnValue(mockPaginatedTickets);
    render(<SupportTab />);
    const resolveButtons = screen.getAllByText("Resolve");
    expect(resolveButtons.length).toBe(1);
  });

  it("does not render resolve button for resolved tickets", () => {
    mockUseQuery.mockReturnValue({
      page: [mockTickets[1]],
      isDone: true,
      continueCursor: "",
      totalCount: 1,
      pageStatus: null,
      splitCursor: null,
    });
    render(<SupportTab />);
    expect(screen.queryByText("Resolve")).not.toBeInTheDocument();
  });

  it("opens resolve dialog when clicking resolve", () => {
    mockUseQuery.mockReturnValue(mockPaginatedTickets);
    render(<SupportTab />);
    fireEvent.click(screen.getByText("Resolve"));
    expect(screen.getByText("Resolve Support Ticket")).toBeInTheDocument();
  });

  it("closes dialog on cancel", () => {
    mockUseQuery.mockReturnValue(mockPaginatedTickets);
    render(<SupportTab />);
    fireEvent.click(screen.getByText("Resolve"));
    expect(screen.getByText("Resolve Support Ticket")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(
      screen.queryByText("Resolve Support Ticket")
    ).not.toBeInTheDocument();
  });

  it("displays priority badges", () => {
    mockUseQuery.mockReturnValue(mockPaginatedTickets);
    render(<SupportTab />);
    expect(screen.getAllByText("high").length).toBeGreaterThan(0);
    expect(screen.getAllByText("medium").length).toBeGreaterThan(0);
  });

  it("resolves a ticket successfully", async () => {
    mockUseQuery.mockReturnValue(mockPaginatedTickets);
    const mockResolveTicket = vi.fn().mockResolvedValue(undefined);
    mockUseMutation.mockReturnValue(mockResolveTicket);

    render(<SupportTab />);
    fireEvent.click(screen.getByText("Resolve"));

    const textarea = screen.getByPlaceholderText(/Describe the resolution/i);
    fireEvent.change(textarea, { target: { value: "Fixed the issue" } });

    fireEvent.click(screen.getByText("Confirm Resolution"));

    await waitFor(() => {
      expect(mockResolveTicket).toHaveBeenCalledWith({
        ticketId: "ticket-1",
        resolution: "Fixed the issue",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Ticket resolved");
    });
  });

  it("handles resolve ticket with error", async () => {
    mockUseQuery.mockReturnValue(mockPaginatedTickets);
    const mockResolveTicket = vi
      .fn()
      .mockRejectedValue(new Error("Resolution failed"));
    mockUseMutation.mockReturnValue(mockResolveTicket);

    render(<SupportTab />);
    fireEvent.click(screen.getByText("Resolve"));

    const textarea = screen.getByPlaceholderText(/Describe the resolution/i);
    fireEvent.change(textarea, { target: { value: "Fixed the issue" } });

    fireEvent.click(screen.getByText("Confirm Resolution"));

    await waitFor(() => {
      expect(mockResolveTicket).toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith("Resolution failed");
    });
  });
});
