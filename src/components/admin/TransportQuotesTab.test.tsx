import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Id } from "convex/_generated/dataModel";

import { TransportQuotesTab } from "./TransportQuotesTab";

const { mockUseQuery, mockMarkHandled, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockUseQuery: vi.fn(),
    mockMarkHandled: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("convex/react", () => ({
  useQuery: mockUseQuery,
  useMutation: () => mockMarkHandled,
}));
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getTransportQuotes: "admin:getTransportQuotes",
      markTransportQuoteHandled: "admin:markTransportQuoteHandled",
    },
  },
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

const base = {
  _creationTime: 1,
  pickup: "Malmesbury, Western Cape",
  deliveryTown: "Bloemfontein",
  deliveryProvince: "free_state" as const,
  phone: "+27837000000",
  createdAt: Date.UTC(2025, 10, 23, 8, 0),
};

const rows = [
  {
    ...base,
    _id: "r1" as Id<"transportQuoteRequests">,
    name: "Thandi",
    lotLabel: "John Deere 5075E · Lot 4",
    notes: "Two trailers",
    status: "new" as const,
  },
  {
    ...base,
    _id: "r2" as Id<"transportQuoteRequests">,
    name: "Pieter",
    status: "handled" as const,
  },
];

/**
 * Builds a paginated result.
 *
 * @param page - The rows
 * @param isDone - Whether it is the last page
 * @returns The query result
 */
const paged = (page: typeof rows, isDone = true) => ({
  page,
  isDone,
  continueCursor: isDone ? "" : "cursor-2",
  totalCount: page.length,
  pageStatus: null,
  splitCursor: null,
});

describe("TransportQuotesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(paged(rows));
    mockMarkHandled.mockResolvedValue(null);
  });

  it("shows a loader while loading", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<TransportQuotesTab />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    mockUseQuery.mockReturnValue(paged([]));
    render(<TransportQuotesTab />);
    expect(screen.getByText("No transport quote requests")).toBeVisible();
  });

  it("lists requests with a tel link, lot label, delivery and status", () => {
    render(<TransportQuotesTab />);
    expect(screen.getByText("Thandi")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "+27837000000" })[0]
    ).toHaveAttribute("href", "tel:+27837000000");
    expect(screen.getByText("John Deere 5075E · Lot 4")).toBeVisible();
    expect(screen.getByText("Two trailers")).toBeVisible();
    expect(screen.getAllByText("Bloemfontein, Free State")).toHaveLength(2);
    expect(screen.getByText("new")).toBeVisible();
    expect(screen.getByText("handled")).toBeVisible();
  });

  it("offers Mark handled on new requests only and toasts on success", async () => {
    render(<TransportQuotesTab />);
    const buttons = screen.getAllByRole("button", { name: "Mark handled" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(mockMarkHandled).toHaveBeenCalledWith({ requestId: "r1" });
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Marked as handled");
    });
  });

  it("shows an error toast when marking fails", async () => {
    mockMarkHandled.mockRejectedValue(new Error("Nope"));
    render(<TransportQuotesTab />);
    fireEvent.click(screen.getByRole("button", { name: "Mark handled" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Nope");
    });
  });

  it("pages forward and back with a cursor stack", () => {
    mockUseQuery.mockReturnValue(paged(rows, false));
    render(<TransportQuotesTab />);
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(mockUseQuery).toHaveBeenLastCalledWith("admin:getTransportQuotes", {
      paginationOpts: { numItems: 50, cursor: "cursor-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(mockUseQuery).toHaveBeenLastCalledWith("admin:getTransportQuotes", {
      paginationOpts: { numItems: 50, cursor: null },
    });
  });
});
