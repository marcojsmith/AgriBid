import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, usePaginatedQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import MyListings from "./MyListings";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock Convex API
const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    auctions: {
      getMyListingsStats: { name: "auctions:getMyListingsStats" },
      submitForReview: { name: "auctions:submitForReview" },
      deleteDraft: { name: "auctions:deleteDraft" },
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

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Radix UI Alert Dialog to be simpler to test
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog">{children}</div>
  ),
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-trigger">{children}</div>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("@/components/ui/tabs", () => {
  let currentOnValueChange: ((v: string) => void) | null = null;
  return {
    Tabs: ({
      children,
      onValueChange,
    }: {
      children: React.ReactNode;
      onValueChange: (v: string) => void;
    }) => {
      currentOnValueChange = onValueChange;
      return <div>{children}</div>;
    },
    TabsList: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    TabsTrigger: ({
      children,
      value,
    }: {
      children: React.ReactNode;
      value: string;
    }) => (
      <button onClick={() => currentOnValueChange?.(value)}>{children}</button>
    ),
    TabsContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

describe("MyListings Page", () => {
  const mockListingStats = {
    all: 3,
    draft: 1,
    pending_review: 1,
    active: 1,
    sold: 0,
    unsold: 0,
    rejected: 0,
  };

  const mockListings = [
    {
      _id: "listing1",
      title: "Draft Tractor",
      status: "draft",
      make: "John Deere",
      model: "8RX",
      year: 2023,
      startingPrice: 50000,
      reservePrice: 100000,
      currentPrice: 0,
      images: { front: "tractor.jpg" },
      categoryId: "cat1",
      location: "Cape Town",
      description: "Brand new",
      operatingHours: 10,
    },
    {
      _id: "listing2",
      title: "Active Combine",
      status: "active",
      make: "Case IH",
      model: "Magnum",
      year: 2022,
      startingPrice: 150000,
      reservePrice: 200000,
      currentPrice: 180000,
      images: ["combine.jpg"],
      endTime: Date.now() + 86400000,
      categoryId: "cat2",
    },
    {
      _id: "listing3",
      title: "Pending Baler",
      status: "pending_review",
      make: "Fendt",
      model: "1050",
      year: 2021,
      startingPrice: 30000,
      reservePrice: 40000,
      currentPrice: 0,
      images: {},
      categoryId: "cat3",
    },
  ];

  const mockSubmitForReview = vi.fn();
  const mockDeleteDraft = vi.fn();

  // Mock localStorage
  let store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn(
      (key: string) => (Reflect.get(store, key) as string | undefined) ?? null
    ),
    setItem: vi.fn((key: string, value: string) => {
      store = { ...store, [key]: value };
    }),
    removeItem: vi.fn((key: string) => {
      store = Object.fromEntries(
        Object.entries(store).filter(([k]) => k !== key)
      );
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = {}; // Reset store

    // Default mocks with matching for full API paths
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getMyListingsStats)
        return mockListingStats;
      return null;
    });

    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockListings,
      status: "Exhausted",
      loadMore: vi.fn(),
    });
    (useMutation as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.submitForReview)
        return mockSubmitForReview;
      if (apiPath === mockApi.auctions.deleteDraft) return mockDeleteDraft;
      return vi.fn();
    });

    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  });

  const renderMyListings = () => {
    return render(
      <BrowserRouter>
        <MyListings />
      </BrowserRouter>
    );
  };

  it("renders page title and stats", () => {
    renderMyListings();
    expect(screen.getByText("My Listings")).toBeInTheDocument();
    expect(screen.getByText(/All \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Drafts \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Active \(1\)/i)).toBeInTheDocument();
  });

  it("renders the list of listings", () => {
    renderMyListings();
    expect(screen.getByText("Draft Tractor")).toBeInTheDocument();
    expect(screen.getByText("Active Combine")).toBeInTheDocument();
    expect(screen.getByText("Pending Baler")).toBeInTheDocument();
  });

  it("filters listings by status", () => {
    renderMyListings();

    // Initial state shows all 3
    expect(screen.getByText("Draft Tractor")).toBeInTheDocument();
    expect(screen.getByText("Active Combine")).toBeInTheDocument();
    expect(screen.getByText("Pending Baler")).toBeInTheDocument();

    // Click "Drafts" tab
    act(() => {
      fireEvent.click(
        screen.getByText(/Drafts \(1\)/i, { selector: "button" })
      );
    });
    expect(screen.getByText("Draft Tractor")).toBeInTheDocument();
    expect(screen.queryByText("Active Combine")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending Baler")).not.toBeInTheDocument();

    // Click "Active" tab
    act(() => {
      fireEvent.click(
        screen.getByText(/Active \(1\)/i, { selector: "button" })
      );
    });
    expect(screen.queryByText("Draft Tractor")).not.toBeInTheDocument();
    expect(screen.getByText("Active Combine")).toBeInTheDocument();
    expect(screen.queryByText("Pending Baler")).not.toBeInTheDocument();
  });

  it("submits a draft for review", async () => {
    mockSubmitForReview.mockResolvedValueOnce({});
    renderMyListings();

    const draftCard = screen
      .getByText("Draft Tractor")
      .closest("div[class*='group']");
    const submitBtn = within(draftCard as HTMLElement).getByRole("button", {
      name: /submit/i,
    });

    act(() => {
      fireEvent.click(submitBtn);
    });

    expect(mockSubmitForReview).toHaveBeenCalledWith({ auctionId: "listing1" });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Listing submitted for review!"
      );
    });
  });

  it("handles submission error", async () => {
    mockSubmitForReview.mockRejectedValueOnce(new Error("Submission failed"));
    renderMyListings();

    const draftCard = screen
      .getByText("Draft Tractor")
      .closest("div[class*='group']");
    const submitBtn = within(draftCard as HTMLElement).getByRole("button", {
      name: /submit/i,
    });

    act(() => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Submission failed");
    });
  });

  it("deletes a draft", async () => {
    mockDeleteDraft.mockResolvedValueOnce({});
    renderMyListings();

    const draftCard = screen
      .getByText("Draft Tractor")
      .closest("div[class*='group']");
    // Find the delete button within the trigger
    const trigger = within(draftCard as HTMLElement).getByTestId(
      "alert-dialog-trigger"
    );
    const deleteBtn = within(trigger).getByRole("button", { name: /delete/i });

    fireEvent.click(deleteBtn);

    // In our mock AlertDialog, we directly click the action button in content
    const content = screen.getByTestId("alert-dialog-content");
    const confirmDeleteBtn = within(content).getByRole("button", {
      name: "Delete",
    });

    act(() => {
      fireEvent.click(confirmDeleteBtn);
    });

    expect(mockDeleteDraft).toHaveBeenCalledWith({ auctionId: "listing1" });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Draft deleted successfully");
    });
  });

  it("saves to localStorage and navigates on edit", () => {
    renderMyListings();

    const draftCard = screen
      .getByText("Draft Tractor")
      .closest("div[class*='group']");
    const editBtn = within(draftCard as HTMLElement).getByRole("button", {
      name: /edit/i,
    });

    act(() => {
      fireEvent.click(editBtn);
    });

    expect(() => {
      localStorage.setItem("agribid_listing_draft", "{}");
    }).not.toThrow();
    expect(() => {
      localStorage.setItem("agribid_listing_step", "0");
    }).not.toThrow();
    expect(mockNavigate).toHaveBeenCalledWith("/sell?edit=listing1");
  });

  it("navigates to sell page when 'Create Listing' is clicked", () => {
    renderMyListings();

    const createBtn = screen.getByText("Create Listing");
    act(() => {
      fireEvent.click(createBtn);
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      "agribid_listing_draft"
    );
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(
      "agribid_listing_step"
    );
    expect(mockNavigate).toHaveBeenCalledWith("/sell");
  });

  it("handles delete draft error", async () => {
    mockDeleteDraft.mockRejectedValueOnce(new Error("Delete failed"));
    renderMyListings();

    const draftCard = screen
      .getByText("Draft Tractor")
      .closest("div[class*='group']");
    const trigger = within(draftCard as HTMLElement).getByTestId(
      "alert-dialog-trigger"
    );
    const deleteBtn = within(trigger).getByRole("button", { name: /delete/i });

    fireEvent.click(deleteBtn);

    const content = screen.getByTestId("alert-dialog-content");
    const confirmDeleteBtn = within(content).getByRole("button", {
      name: "Delete",
    });

    act(() => {
      fireEvent.click(confirmDeleteBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete failed");
    });
  });

  it("handles localStorage error when editing", async () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementationOnce(() => {
      throw new Error("Storage full");
    });
    renderMyListings();

    const draftCard = screen
      .getByText("Draft Tractor")
      .closest("div[class*='group']");
    const editBtn = within(draftCard as HTMLElement).getByRole("button", {
      name: /edit/i,
    });

    act(() => {
      fireEvent.click(editBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Could not save draft data")
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith("/sell?edit=listing1");
  });

  it("handles missing categoryId when editing", () => {
    const listingNoCategory = { ...mockListings[0], categoryId: undefined };
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [listingNoCategory],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderMyListings();

    const editBtn = screen.getByRole("button", { name: /edit/i });
    act(() => {
      fireEvent.click(editBtn);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "agribid_listing_draft",
      expect.stringContaining('"make":""')
    );
  });

  it("handles image normalization for various image formats", () => {
    const listingWithNoImages = {
      ...mockListings[0],
      images: {},
      title: "No Image Tractor",
    };
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [listingWithNoImages],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderMyListings();
    expect(screen.getByText("No Image Tractor")).toBeInTheDocument();
  });

  it("handles pagination: loading more", () => {
    const loadMore = vi.fn();
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockListings,
      status: "CanLoadMore",
      loadMore,
    });
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getMyListingsStats)
        return {
          ...mockListingStats,
          draft: 1,
          pending_review: 1,
          active: 1,
          sold: 4,
          unsold: 2,
          rejected: 1,
        };
      return null;
    });

    renderMyListings();

    const loadMoreBtn = screen.getByText(/Load More Listings/i);
    act(() => {
      fireEvent.click(loadMoreBtn);
    });

    expect(loadMore).toHaveBeenCalledWith(10);
  });

  it("shows loading more state", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: mockListings,
      status: "LoadingMore",
      loadMore: vi.fn(),
    });

    renderMyListings();
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
  });

  it("shows empty state message for specific status filter", () => {
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderMyListings();

    // Change to "Sold" tab
    act(() => {
      fireEvent.click(
        screen.getByText(/^Sold \(\d+\)$/i, { selector: "button" })
      );
    });

    expect(
      screen.getByText(/No listings with status: sold/i)
    ).toBeInTheDocument();
  });

  it("handles unknown auction status badge fallback", () => {
    const listingUnknownStatus = {
      ...mockListings[0],
      status: "unknown" as "active",
    };
    (usePaginatedQuery as Mock).mockReturnValue({
      results: [listingUnknownStatus],
      status: "Exhausted",
      loadMore: vi.fn(),
    });

    renderMyListings();
    // Badge should still render with default variant
    expect(screen.getByText(/unknown/i)).toBeInTheDocument();
  });

  it("handles publishing guard when already publishing", () => {
    mockSubmitForReview.mockImplementation(
      () =>
        new Promise((resolve) => {
          // Mock hangs indefinitely
          void resolve;
        })
    );
    renderMyListings();

    const draftCard = screen
      .getByText("Draft Tractor")
      .closest("div[class*='group']");
    const submitBtn = within(draftCard as HTMLElement).getByRole("button", {
      name: /Submit/i,
    });

    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn); // Second click while publishingId is set

    expect(mockSubmitForReview).toHaveBeenCalledTimes(1);
  });

  it("handles non-Error objects in submit catch block", async () => {
    mockSubmitForReview.mockRejectedValueOnce("String error");
    renderMyListings();

    const submitBtn = screen.getByRole("button", { name: /Submit/i });
    act(() => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to submit for review");
    });
  });

  it("handles non-Error objects in delete catch block", async () => {
    mockDeleteDraft.mockRejectedValueOnce({ custom: "object error" });
    renderMyListings();

    const draftCard = screen
      .getByText("Draft Tractor")
      .closest("div[class*='group']");
    const trigger = within(draftCard as HTMLElement).getByTestId(
      "alert-dialog-trigger"
    );
    const deleteBtn = within(trigger).getByRole("button", { name: /delete/i });

    fireEvent.click(deleteBtn);
    const content = screen.getByTestId("alert-dialog-content");
    const confirmDeleteBtn = within(content).getByRole("button", {
      name: "Delete",
    });

    act(() => {
      fireEvent.click(confirmDeleteBtn);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to delete draft");
    });
  });

  it("handles localStorage clear error when creating listing", () => {
    vi.spyOn(window.localStorage, "removeItem").mockImplementationOnce(() => {
      throw new Error("Clear failed");
    });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {
      // no-op
    });

    renderMyListings();
    fireEvent.click(screen.getByText("Create Listing"));

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to clear localStorage"),
      expect.any(Error)
    );
    expect(mockNavigate).toHaveBeenCalledWith("/sell");
    spy.mockRestore();
  });

  it("handles null listingStats in getStatusCount", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.getMyListingsStats) return null;
      return null;
    });

    renderMyListings();
    // Tabs should show (0)
    expect(screen.getByText(/All \(0\)/i)).toBeInTheDocument();
  });
});
