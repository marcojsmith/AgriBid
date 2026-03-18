import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import Support from "./Support";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock Convex API
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    support: {
      getMyTickets: { name: "support:getMyTickets" },
      createTicket: { name: "support:createTicket" },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock select component since it's a Radix primitive that can be hard to test
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <select
      value={value}
      onChange={(e) => {
        onValueChange(e.target.value);
      }}
      aria-label="Priority"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <>{placeholder}</>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

describe("Support Page", () => {
  const mockTickets = [
    {
      _id: "ticket1",
      subject: "Bidding Issue",
      message: "I cannot place a bid",
      status: "open",
      priority: "high",
      createdAt: Date.now(),
    },
    {
      _id: "ticket2",
      subject: "General Question",
      message: "How do I verify my account?",
      status: "resolved",
      priority: "low",
      createdAt: Date.now() - 86400000,
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

  const mockCreateTicket = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.support.getMyTickets) return mockPaginatedTickets;
      return null;
    });
    (useMutation as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.support.createTicket) return mockCreateTicket;
      return mockCreateTicket; // Default for backward compatibility in this test
    });
  });

  const renderSupport = () => {
    return render(
      <BrowserRouter>
        <Support />
      </BrowserRouter>
    );
  };

  it("renders page title and ticket form", () => {
    renderSupport();
    expect(screen.getByText("Help & Support")).toBeInTheDocument();
    expect(screen.getByText("Open New Ticket")).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /submit support ticket/i })
    ).toBeInTheDocument();
  });

  it("renders the list of existing tickets", () => {
    renderSupport();
    expect(screen.getByText("My Tickets")).toBeInTheDocument();
    expect(screen.getByText("Bidding Issue")).toBeInTheDocument();
    expect(screen.getByText("General Question")).toBeInTheDocument();
    expect(screen.getAllByText("open")).toHaveLength(1);
    expect(screen.getAllByText("resolved")).toHaveLength(1);
  });

  it("submits a new support ticket successfully", async () => {
    mockCreateTicket.mockResolvedValueOnce({});
    renderSupport();

    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "New Issue" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Detailed description" },
    });

    const submitBtn = screen.getByRole("button", {
      name: /submit support ticket/i,
    });
    await act(() => {
      fireEvent.click(submitBtn);
    });

    expect(mockCreateTicket).toHaveBeenCalledWith({
      subject: "New Issue",
      message: "Detailed description",
      priority: "medium", // Default value
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Support ticket created");
      // Form should be reset
      expect(screen.getByLabelText(/subject/i)).toHaveValue("");
      expect(screen.getByLabelText(/message/i)).toHaveValue("");
    });
  });

  it("shows error toast if subject or message is empty", async () => {
    renderSupport();

    // Input spaces to pass HTML5 validation but fail custom validation
    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "   " },
    });

    const submitBtn = screen.getByRole("button", {
      name: /submit support ticket/i,
    });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Subject and message cannot be empty"
      );
      expect(mockCreateTicket).not.toHaveBeenCalled();
    });
  });

  it("renders empty state when no tickets are found", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.support.getMyTickets)
        return {
          page: [],
          isDone: true,
          continueCursor: "",
          totalCount: 0,
          pageStatus: null,
          splitCursor: null,
        };
      return null;
    });
    renderSupport();
    expect(screen.getByText("No active tickets")).toBeInTheDocument();
  });

  it("shows loading state when tickets are being fetched", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.support.getMyTickets) return undefined;
      return null;
    });
    renderSupport();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("handles priority change", () => {
    renderSupport();
    const select = screen.getByLabelText("Priority");
    fireEvent.change(select, { target: { value: "high" } });
    expect(select).toHaveValue("high");
  });

  it("handles ticket creation failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      void "suppress error logging";
    });
    mockCreateTicket.mockRejectedValue(new Error("Creation failed"));

    renderSupport();

    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: "Fail" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "Fail" },
    });

    const submitBtn = screen.getByRole("button", {
      name: /submit support ticket/i,
    });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Creation failed");
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });
});
