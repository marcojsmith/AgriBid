import { render, screen, fireEvent } from "@testing-library/react";
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
    mockUseQuery.mockReturnValue(mockTickets);
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it("renders tickets table with data", () => {
    mockUseQuery.mockReturnValue(mockTickets);
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
    mockUseQuery.mockReturnValue([]);
    render(<SupportTab />);
    expect(screen.getByText("No support tickets")).toBeInTheDocument();
  });

  it("renders open ticket with resolve button", () => {
    mockUseQuery.mockReturnValue(mockTickets);
    render(<SupportTab />);
    const resolveButtons = screen.getAllByText("Resolve");
    expect(resolveButtons.length).toBe(1);
  });

  it("does not render resolve button for resolved tickets", () => {
    mockUseQuery.mockReturnValue([mockTickets[1]]);
    render(<SupportTab />);
    expect(screen.queryByText("Resolve")).not.toBeInTheDocument();
  });

  it("opens resolve dialog when clicking resolve", () => {
    mockUseQuery.mockReturnValue(mockTickets);
    render(<SupportTab />);
    fireEvent.click(screen.getByText("Resolve"));
    expect(screen.getByText("Resolve Support Ticket")).toBeInTheDocument();
  });

  it("closes dialog on cancel", () => {
    mockUseQuery.mockReturnValue(mockTickets);
    render(<SupportTab />);
    fireEvent.click(screen.getByText("Resolve"));
    expect(screen.getByText("Resolve Support Ticket")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));
    expect(
      screen.queryByText("Resolve Support Ticket")
    ).not.toBeInTheDocument();
  });

  it("displays priority badges", () => {
    mockUseQuery.mockReturnValue(mockTickets);
    render(<SupportTab />);
    expect(screen.getAllByText("high").length).toBeGreaterThan(0);
    expect(screen.getAllByText("medium").length).toBeGreaterThan(0);
  });
});
