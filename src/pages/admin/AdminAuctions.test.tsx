import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { toast } from "sonner";

vi.mock("@/contexts/useAdminStats", () => ({
  useAdminStats: vi.fn(() => ({
    adminStats: { totalAuctions: 10 },
    isLoading: false,
    error: null,
  })),
}));

import AdminAuctions from "./AdminAuctions";

// Mock Navigate
const mockNavigate = vi.fn();

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Mock PointerEvent for Radix UI
if (!global.PointerEvent) {
  class MockPointerEvent extends MouseEvent {
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    button: number;
    buttons: number;

    constructor(type: string, props: PointerEventInit = {}) {
      super(type, props);
      this.pointerId = props.pointerId || 0;
      this.width = props.width || 0;
      this.height = props.height || 0;
      this.pressure = props.pressure || 0;
      this.button = props.button || 0;
      this.buttons = props.buttons || 0;
    }
  }
  global.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
}

/**
 * Trigger Radix UI DropdownMenu by simulating pointer events.
 * @param trigger - The element that triggers the dropdown
 */
const openDropdown = (trigger: HTMLElement) => {
  fireEvent.pointerDown(trigger);
  fireEvent.pointerUp(trigger);
  fireEvent.click(trigger);
};

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock convex/_generated/api
vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      getAdminStats: "admin:getAdminStats",
    },
    auctions: {
      getAllAuctions: "auctions:getAllAuctions",
      closeAuctionEarly: "auctions:closeAuctionEarly",
      bulkUpdateAuctions: "auctions:bulkUpdateAuctions",
    },
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockAdminStats = {
  totalAuctions: 10,
  totalUsers: 100,
  liveUsers: 5,
  pendingReview: 2,
};

const mockAuctions = [
  {
    _id: "auction1",
    title: "John Deere Tractor",
    make: "John Deere",
    model: "7R 330",
    year: 2021,
    status: "active",
    currentPrice: 150000,
    reservePrice: 140000,
    endTime: Date.now() + 86400000, // 1 day from now
    categoryName: "Tractors",
  },
  {
    _id: "auction2",
    title: "Case IH Combine",
    make: "Case IH",
    model: "Axial-Flow 8250",
    year: 2020,
    status: "pending_review",
    currentPrice: 0,
    reservePrice: 250000,
    endTime: Date.now() + 172800000, // 2 days from now
    categoryName: "Combines",
  },
  {
    _id: "auction3",
    title: "Old Plow",
    make: "Generic",
    model: "P-100",
    year: 1990,
    status: "sold",
    currentPrice: 5000,
    reservePrice: 4000,
    endTime: Date.now() - 3600000, // 1 hour ago
    categoryName: "Implements",
  },
];

describe("AdminAuctions", () => {
  const closeAuctionEarlyMock = vi.fn();
  const bulkUpdateAuctionsMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useQuery as Mock).mockImplementation((name: string) => {
      if (name === "admin:getAdminStats") return mockAdminStats;
      return undefined;
    });

    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockAuctions,
      status: "CanLoadMore",
      loadMore: vi.fn(),
    });

    (useMutation as Mock).mockImplementation((name: string) => {
      if (name === "auctions:closeAuctionEarly") return closeAuctionEarlyMock;
      if (name === "auctions:bulkUpdateAuctions") return bulkUpdateAuctionsMock;
      return vi.fn();
    });
  });

  const renderComponent = () =>
    render(
      <BrowserRouter>
        <AdminAuctions />
      </BrowserRouter>
    );

  it("renders the loading state initially", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: undefined,
      status: "LoadingFirstPage",
      loadMore: vi.fn(),
    });
    (useQuery as Mock).mockImplementation((name: string) => {
      if (name === "admin:getAdminStats") return undefined;
      return undefined;
    });

    renderComponent();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });

  it("renders the list of auctions", () => {
    renderComponent();

    expect(screen.getByText("John Deere Tractor")).toBeInTheDocument();
    expect(screen.getByText("Case IH Combine")).toBeInTheDocument();
    expect(screen.getByText("Old Plow")).toBeInTheDocument();

    // Check status badges
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Sold")).toBeInTheDocument();
  });

  it("filters auctions based on search input", async () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText("Search Auctions...");
    fireEvent.change(searchInput, { target: { value: "John Deere" } });

    expect(screen.getByText("John Deere Tractor")).toBeInTheDocument();
    expect(screen.queryByText("Case IH Combine")).not.toBeInTheDocument();

    // Check specific filtering by model
    fireEvent.change(searchInput, { target: { value: "Axial-Flow" } });
    expect(screen.queryByText("John Deere Tractor")).not.toBeInTheDocument();
    expect(screen.getByText("Case IH Combine")).toBeInTheDocument();
  });

  it("handles individual auction selection", async () => {
    renderComponent();

    const row = screen.getByText("John Deere Tractor").closest("tr")!;
    const checkbox = within(row).getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(screen.getByText("1 Items Selected")).toBeInTheDocument();
  });

  it("handles select all functionality", async () => {
    renderComponent();

    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(selectAllCheckbox);

    expect(screen.getByText("3 Items Selected")).toBeInTheDocument();

    fireEvent.click(selectAllCheckbox);
    expect(screen.queryByText("3 Items Selected")).not.toBeInTheDocument();
  });

  it("handles force ending an auction", async () => {
    closeAuctionEarlyMock.mockResolvedValue({
      success: true,
      finalStatus: "sold",
      winnerId: "user1",
      winningAmount: 150000,
    });

    renderComponent();

    const firstRow = screen.getByText("John Deere Tractor").closest("tr")!;
    const actionButton = within(firstRow).getAllByRole("button").pop()!;

    openDropdown(actionButton);

    await waitFor(() => {
      expect(screen.getByText("Force End")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Force End"));

    await waitFor(() => {
      expect(screen.getByText("Close Auction Early?")).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: "Close Auction" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(closeAuctionEarlyMock).toHaveBeenCalledWith({
        auctionId: "auction1",
      });
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Awarded to highest bidder")
      );
    });
  });

  it("handles force ending an auction with no reserve met", async () => {
    closeAuctionEarlyMock.mockResolvedValue({
      success: true,
      finalStatus: "unsold",
    });

    renderComponent();

    const firstRow = screen.getByText("John Deere Tractor").closest("tr")!;
    const actionButton = within(firstRow).getAllByRole("button").pop()!;

    openDropdown(actionButton);

    await waitFor(() => {
      expect(screen.getByText("Force End")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Force End"));

    await waitFor(() => {
      expect(screen.getByText("Close Auction Early?")).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", { name: "Close Auction" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("marked as unsold")
      );
    });
  });

  it("handles bulk status update to active", async () => {
    bulkUpdateAuctionsMock.mockResolvedValue({ success: true });

    renderComponent();

    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(selectAllCheckbox);

    const markActiveButton = screen.getByRole("button", {
      name: "Mark Active",
    });
    fireEvent.click(markActiveButton);

    await waitFor(() => {
      expect(
        screen.getByText("Perform Bulk Status Update?")
      ).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", {
      name: "Confirm Update",
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(bulkUpdateAuctionsMock).toHaveBeenCalledWith({
        auctionIds: ["auction1", "auction2", "auction3"],
        updates: { status: "active" },
      });
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Updated 3 auctions to active")
      );
    });
  });

  it("handles bulk status update to unsold", async () => {
    bulkUpdateAuctionsMock.mockResolvedValue({ success: true });

    renderComponent();

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]); // Select first item

    const endUnsoldButton = screen.getByRole("button", { name: "End Unsold" });
    fireEvent.click(endUnsoldButton);

    await waitFor(() => {
      expect(
        screen.getByText("Perform Bulk Status Update?")
      ).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole("button", {
      name: "Confirm Update",
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(bulkUpdateAuctionsMock).toHaveBeenCalledWith({
        auctionIds: ["auction1"],
        updates: { status: "unsold" },
      });
    });
  });

  it("shows indeterminate state when some items are selected", () => {
    renderComponent();

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]); // Select first item

    const selectAllCheckbox = checkboxes[0];
    expect(selectAllCheckbox).toHaveAttribute("data-state", "indeterminate");
  });

  it("renders empty state when no auctions match search", () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText("Search Auctions...");
    fireEvent.change(searchInput, {
      target: { value: "Non-existent equipment" },
    });

    expect(
      screen.getByText("No auctions found matching your search.")
    ).toBeInTheDocument();
  });

  it("handles load more functionality", () => {
    const loadMoreMock = vi.fn();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockAuctions,
      status: "CanLoadMore",
      loadMore: loadMoreMock,
    });

    renderComponent();

    const loadMoreButton = screen.getByText("Load More");
    fireEvent.click(loadMoreButton);

    expect(loadMoreMock).toHaveBeenCalledWith(50);
  });

  it("handles close auction early error", async () => {
    closeAuctionEarlyMock.mockRejectedValue(new Error("Network error"));

    renderComponent();

    const firstRow = screen.getByText("John Deere Tractor").closest("tr")!;
    const actionButton = within(firstRow).getAllByRole("button").pop()!;
    openDropdown(actionButton);
    await waitFor(() =>
      expect(screen.getByText("Force End")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Force End"));

    const confirmButton = screen.getByRole("button", { name: "Close Auction" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Network error—please try again"
      );
    });
  });

  it("handles close auction early failure result", async () => {
    closeAuctionEarlyMock.mockResolvedValue({
      success: false,
      error: "Custom failure reason",
    });

    renderComponent();

    const firstRow = screen.getByText("John Deere Tractor").closest("tr")!;
    const actionButton = within(firstRow).getAllByRole("button").pop()!;
    openDropdown(actionButton);
    await waitFor(() =>
      expect(screen.getByText("Force End")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Force End"));

    const confirmButton = screen.getByRole("button", { name: "Close Auction" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Custom failure reason");
    });
  });

  it("navigates to auction details", async () => {
    renderComponent();

    const firstRow = screen.getByText("John Deere Tractor").closest("tr")!;
    const actionButton = within(firstRow).getAllByRole("button").pop()!;
    openDropdown(actionButton);

    await waitFor(() =>
      expect(screen.getByText("View Details")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("View Details"));

    expect(mockNavigate).toHaveBeenCalledWith("/auction/auction1");
  });

  it("handles bulk action cancellation", async () => {
    renderComponent();

    const selectAllCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(selectAllCheckbox);
    expect(screen.getByText("3 Items Selected")).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(screen.queryByText("3 Items Selected")).not.toBeInTheDocument();
  });

  it("renders all status badges", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        ...mockAuctions,
        {
          _id: "auction4",
          title: "Unsold Item",
          status: "unsold",
          currentPrice: 0,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction5",
          title: "Rejected Item",
          status: "rejected",
          currentPrice: 0,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction6",
          title: "Other Item",
          status: "other",
          currentPrice: 0,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
      ],
      status: "CanLoadMore",
      loadMore: vi.fn(),
    });

    renderComponent();

    expect(screen.getByText("Unsold")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("other")).toBeInTheDocument();
  });

  it("displays different time remaining formats", async () => {
    const now = 1742030400000; // Fixed timestamp
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "auction1",
          title: "Days Left",
          status: "active",
          endTime: now + 2 * 86400000 + 5 * 3600000, // 2 days 5 hours
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction2",
          title: "Hours Left",
          status: "active",
          endTime: now + 5 * 3600000 + 10 * 60000, // 5 hours 10 mins
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction3",
          title: "Minutes Left",
          status: "active",
          endTime: now + 10 * 60000, // 10 mins
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction4",
          title: "Seconds Left",
          status: "active",
          endTime: now + 30 * 1000, // 30 secs
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction5",
          title: "Exactly 1 Day",
          status: "active",
          endTime: now + 86400000,
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction6",
          title: "Exactly 1 Hour",
          status: "active",
          endTime: now + 3600000,
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction7",
          title: "Exactly 1 Minute",
          status: "active",
          endTime: now + 60000,
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction8",
          title: "Exactly 1 Second",
          status: "active",
          endTime: now + 1000,
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
      ],
      status: "CanLoadMore",
      loadMore: vi.fn(),
    });

    renderComponent();

    const openForceEnd = async (title: string) => {
      const row = screen.getByText(title).closest("tr")!;
      const actionButton = within(row).getAllByRole("button").pop()!;
      openDropdown(actionButton);
      await waitFor(() =>
        expect(screen.getByText("Force End")).toBeInTheDocument()
      );
      fireEvent.click(screen.getByText("Force End"));
      await waitFor(() =>
        expect(screen.getByRole("alertdialog")).toBeInTheDocument()
      );
    };

    await openForceEnd("Days Left");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^2 days, 5 hours$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await openForceEnd("Hours Left");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^5 hours, 10 min$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await openForceEnd("Minutes Left");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^10 minutes$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await openForceEnd("Seconds Left");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^30 seconds$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await openForceEnd("Exactly 1 Day");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^1 day, 0 hours$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await openForceEnd("Exactly 1 Hour");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^1 hour, 0 min$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await openForceEnd("Exactly 1 Minute");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^1 minute$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await openForceEnd("Exactly 1 Second");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^1 second$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Add cases for singular day/hour combinations
    cleanup();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "auction10",
          title: "1 Day 1 Hour",
          status: "active",
          endTime: now + 86400000 + 3600000,
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
        {
          _id: "auction11",
          title: "2 Days 1 Hour",
          status: "active",
          endTime: now + 2 * 86400000 + 3600000,
          currentPrice: 100,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
        },
      ],
      status: "CanLoadMore",
      loadMore: vi.fn(),
    });
    renderComponent();

    await openForceEnd("1 Day 1 Hour");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^1 day, 1 hour$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await openForceEnd("2 Days 1 Hour");
    expect(
      within(screen.getByRole("alertdialog")).getByText(/^2 days, 1 hour$/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    dateSpy.mockRestore();
  }, 30000);

  it("handles close auction early with missing error message", async () => {
    closeAuctionEarlyMock.mockResolvedValue({
      success: false,
      // No error field
    });

    renderComponent();

    const firstRow = screen.getByText("John Deere Tractor").closest("tr")!;
    const actionButton = within(firstRow).getAllByRole("button").pop()!;
    openDropdown(actionButton);
    await waitFor(() =>
      expect(screen.getByText("Force End")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Force End"));

    const confirmButton = screen.getByRole("button", { name: "Close Auction" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to close auction");
    });
  });

  it("displays dash when adminStats is missing", () => {
    (useQuery as Mock).mockImplementation((name: string) => {
      if (name === "admin:getAdminStats") return null;
      if (name === "users:getMyProfile") return { profile: { role: "admin" } };
      return undefined;
    });
    renderComponent();
    expect(screen.getByText(/Showing 3 of — Auctions/i)).toBeInTheDocument();
  });

  it("displays reserve not met status in close dialog", async () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [
        {
          _id: "auction_no_reserve",
          title: "No Reserve Met",
          status: "active",
          currentPrice: 50,
          reservePrice: 100,
          make: "m",
          model: "m",
          year: 2020,
          endTime: Date.now() + 3600000,
        },
      ],
      status: "CanLoadMore",
      loadMore: vi.fn(),
    });

    renderComponent();
    const row = screen.getByText("No Reserve Met").closest("tr")!;
    const actionButton = within(row).getAllByRole("button").pop()!;
    openDropdown(actionButton);
    await waitFor(() =>
      expect(screen.getByText("Force End")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Force End"));

    await waitFor(() => {
      expect(screen.getByText("✗ Not Met")).toBeInTheDocument();
    });
  });

  it("prevents closing dialog when isClosing is true", async () => {
    // Delay resolution to keep isClosing true
    let resolveClose: (val: unknown) => void;
    const closePromise = new Promise((resolve) => {
      resolveClose = resolve;
    });
    closeAuctionEarlyMock.mockReturnValue(closePromise);

    renderComponent();
    const firstRow = screen.getByText("John Deere Tractor").closest("tr")!;
    const actionButton = within(firstRow).getAllByRole("button").pop()!;
    openDropdown(actionButton);
    await waitFor(() =>
      expect(screen.getByText("Force End")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Force End"));

    const confirmButton = screen.getByRole("button", { name: "Close Auction" });
    fireEvent.click(confirmButton);

    // Now isClosing should be true
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });

    // Dialog should still be there
    expect(screen.getByText("Close Auction Early?")).toBeInTheDocument();

    // Resolve and then it should be able to close
    await act(async () => {
      resolveClose!({
        success: true,
        finalStatus: "sold",
        winnerId: "u",
        winningAmount: 100,
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByText("Close Auction Early?")
      ).not.toBeInTheDocument();
    });
  });
});
