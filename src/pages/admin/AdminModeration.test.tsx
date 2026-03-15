import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import AdminModeration from "./AdminModeration";

// Mock convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
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

// Mock api
vi.mock("convex/_generated/api", () => ({
  api: {
    auctions: {
      getPendingAuctions: "auctions:getPendingAuctions",
      getAllPendingFlags: "auctions:getAllPendingFlags",
      approveAuction: "auctions:approveAuction",
      rejectAuction: "auctions:rejectAuction",
      dismissFlag: "auctions:dismissFlag",
    },
    admin: {
      getAdminStats: "admin:getAdminStats",
    },
  },
}));

const mockPendingAuctions = [
  {
    _id: "a1",
    title: "Tractor 2024",
    year: 2024,
    make: "John Deere",
    location: "Iowa",
    startingPrice: 50000,
    categoryName: "Tractors",
    conditionChecklist: {
      engine: true,
      hydraulics: true,
      tires: false,
      serviceHistory: true,
    },
    images: { front: "tractor.jpg" },
  },
  {
    _id: "a3",
    title: "Old Plow",
    year: 1990,
    make: "Generic",
    location: "Ohio",
    startingPrice: 1000,
    // categoryName missing
    conditionChecklist: {
      engine: false,
      // hydraulics missing
      tires: true,
      serviceHistory: false,
    },
    images: [], // empty legacy images
  },
];

const mockPendingFlags = [
  {
    _id: "f1",
    auctionId: "a2",
    auctionTitle: "Flagged Harvester",
    reporterName: "Alice Reporter",
    reason: "misleading",
    details: "The price is too low for this model.",
    createdAt: Date.now(),
  },
];

describe("AdminModeration Page", () => {
  const mockApproveMutation = vi.fn();
  const mockRejectMutation = vi.fn();
  const mockDismissFlagMutation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === "auctions:getPendingAuctions") return mockPendingAuctions;
      if (apiPath === "auctions:getAllPendingFlags") return mockPendingFlags;
      if (apiPath === "admin:getAdminStats")
        return { totalUsers: 100, pendingReview: 5, liveUsers: 10 };
      return undefined;
    });

    (useMutation as Mock).mockImplementation((apiPath) => {
      if (apiPath === "auctions:approveAuction") return mockApproveMutation;
      if (apiPath === "auctions:rejectAuction") return mockRejectMutation;
      if (apiPath === "auctions:dismissFlag") return mockDismissFlagMutation;
      return vi.fn();
    });
  });

  const renderPage = () =>
    render(
      <BrowserRouter>
        <AdminModeration />
      </BrowserRouter>
    );

  it("renders loading state when queries are undefined", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === "auctions:getPendingAuctions") return undefined;
      if (apiPath === "auctions:getAllPendingFlags") return undefined;
      return undefined;
    });
    renderPage();
    expect(
      screen.getByRole("status", { name: /loading/i })
    ).toBeInTheDocument();
  });

  it("renders empty state when there are no pending auctions or flags", () => {
    (useQuery as Mock).mockImplementation((apiPath) => {
      if (apiPath === "auctions:getPendingAuctions") return [];
      if (apiPath === "auctions:getAllPendingFlags") return [];
      if (apiPath === "admin:getAdminStats")
        return { totalUsers: 100, pendingReview: 0, liveUsers: 10 };
      return undefined;
    });
    renderPage();
    expect(screen.getByText(/Queue is Clear/i)).toBeInTheDocument();
    expect(
      screen.getByText(/All pending auctions have been reviewed/i)
    ).toBeInTheDocument();
  });

  it("renders pending auctions and flagged listings", () => {
    renderPage();
    expect(screen.getByText("Tractor 2024")).toBeInTheDocument();
    expect(screen.getByText("Old Plow")).toBeInTheDocument();
    expect(screen.getByText("Flagged Harvester")).toBeInTheDocument();
    expect(screen.getByText(/Alice Reporter/)).toBeInTheDocument();

    // Check condition items for Tractor 2024
    const tractorCard = screen.getByText("Tractor 2024").closest(".group");
    expect(tractorCard).not.toBeNull();
    expect(
      within(tractorCard as HTMLElement).getAllByText("PASS")
    ).toHaveLength(3); // Engine, Hydraulics, History
    expect(
      within(tractorCard as HTMLElement).getAllByText("FAIL")
    ).toHaveLength(1); // Tires

    // Check for "Unknown" category when missing
    expect(screen.getByText("Unknown")).toBeInTheDocument();

    // Check for N/A in condition items for Old Plow
    const oldPlowCard = screen.getByText("Old Plow").closest(".group");
    expect(oldPlowCard).not.toBeNull();
    expect(within(oldPlowCard as HTMLElement).getAllByText("N/A")).toHaveLength(
      1
    ); // Hydraulics missing
  });

  it("handles auction approval successfully", async () => {
    mockApproveMutation.mockResolvedValue({});
    renderPage();

    const approveButton = screen.getAllByRole("button", {
      name: /approve/i,
    })[0];
    fireEvent.click(approveButton);

    expect(mockApproveMutation).toHaveBeenCalledWith({ auctionId: "a1" });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Auction approved");
    });
  });

  it("handles auction approval failure", async () => {
    mockApproveMutation.mockRejectedValue(new Error("Approval failed"));
    renderPage();

    const approveButton = screen.getAllByRole("button", {
      name: /approve/i,
    })[0];
    fireEvent.click(approveButton);

    expect(mockApproveMutation).toHaveBeenCalledWith({ auctionId: "a1" });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to approve auction");
    });
  });

  it("handles auction rejection successfully", async () => {
    mockRejectMutation.mockResolvedValue({});
    renderPage();

    const rejectButton = screen.getAllByRole("button", { name: /reject/i })[0];
    fireEvent.click(rejectButton);

    expect(mockRejectMutation).toHaveBeenCalledWith({ auctionId: "a1" });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Auction rejected");
    });
  });

  it("handles auction rejection failure", async () => {
    mockRejectMutation.mockRejectedValue(new Error("Rejection failed"));
    renderPage();

    const rejectButton = screen.getAllByRole("button", { name: /reject/i })[0];
    fireEvent.click(rejectButton);

    expect(mockRejectMutation).toHaveBeenCalledWith({ auctionId: "a1" });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to reject auction");
    });
  });

  it("handles flag dismissal successfully (with restoration)", async () => {
    mockDismissFlagMutation.mockResolvedValue({ auctionRestored: true });
    renderPage();

    const dismissButton = screen.getByRole("button", { name: /^dismiss$/i });
    fireEvent.click(dismissButton);

    // Should open AlertDialog
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: "Dismiss Flag" })
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Flagged Harvester")).toBeInTheDocument();

    const reasonInput = within(dialog).getByPlaceholderText(
      /Explain why this flag is being dismissed/i
    );
    fireEvent.change(reasonInput, { target: { value: "Valid listing" } });

    const confirmDismissButton = within(dialog).getByRole("button", {
      name: "Dismiss Flag",
    });
    fireEvent.click(confirmDismissButton);

    expect(mockDismissFlagMutation).toHaveBeenCalledWith({
      flagId: "f1",
      dismissalReason: "Valid listing",
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Flag dismissed - auction restored to active"
      );
    });
  });

  it("handles flag dismissal successfully (without restoration)", async () => {
    mockDismissFlagMutation.mockResolvedValue({ auctionRestored: false });
    renderPage();

    const dismissButton = screen.getByRole("button", { name: /^dismiss$/i });
    fireEvent.click(dismissButton);

    const dialog = await screen.findByRole("alertdialog");
    const confirmDismissButton = within(dialog).getByRole("button", {
      name: "Dismiss Flag",
    });
    fireEvent.click(confirmDismissButton);

    expect(mockDismissFlagMutation).toHaveBeenCalledWith({
      flagId: "f1",
      dismissalReason: undefined,
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Flag dismissed");
    });
  });

  it("handles flag dismissal failure", async () => {
    mockDismissFlagMutation.mockRejectedValue(new Error("Dismissal failed"));
    renderPage();

    const dismissButton = screen.getByRole("button", { name: /^dismiss$/i });
    fireEvent.click(dismissButton);

    const dialog = await screen.findByRole("alertdialog");
    const confirmDismissButton = within(dialog).getByRole("button", {
      name: "Dismiss Flag",
    });
    fireEvent.click(confirmDismissButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to dismiss flag");
    });
  });

  it("navigates to auction detail when 'View' or 'Details' is clicked", async () => {
    renderPage();

    // From flagged auction
    const viewFlaggedButton = screen.getAllByRole("button", {
      name: /view/i,
    })[0];
    fireEvent.click(viewFlaggedButton);
    expect(mockNavigate).toHaveBeenCalledWith("/auction/a2");

    // From pending auction (ModerationCard has 'Details' button)
    const viewDetailsButton = screen.getAllByRole("button", {
      name: /details/i,
    })[0];
    fireEvent.click(viewDetailsButton);
    expect(mockNavigate).toHaveBeenCalledWith("/auction/a1");
  });

  it("closes dismiss dialog on cancel", async () => {
    renderPage();

    const dismissButton = screen.getByRole("button", { name: /^dismiss$/i });
    fireEvent.click(dismissButton);

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: "Dismiss Flag" })
    ).toBeInTheDocument();

    const cancelButton = within(dialog).getByRole("button", {
      name: /cancel/i,
    });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});
