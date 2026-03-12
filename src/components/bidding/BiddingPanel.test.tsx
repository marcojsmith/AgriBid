import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import type { Doc, Id } from "convex/_generated/dataModel";
import * as convexReact from "convex/react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";

import { BiddingPanel } from "./BiddingPanel";

// Mock the CountdownTimer since it has its own tests
vi.mock("../CountdownTimer", () => ({
  CountdownTimer: ({ endTime }: { endTime: number }) => (
    <div data-testid="mock-timer">{endTime}</div>
  ),
}));

// Mock auth client
vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Convex hooks
vi.mock("convex/react", () => {
  const mockMutation = Object.assign(vi.fn(), {
    withOptimisticUpdate: vi.fn(),
  });
  mockMutation.withOptimisticUpdate.mockReturnValue(mockMutation);
  return {
    useMutation: vi.fn(() => mockMutation),
    useQuery: vi.fn(),
  };
});

// Mock Radix Alert Dialog
interface AlertDialogProps {
  children: React.ReactNode;
  open?: boolean;
}
interface AlertDialogActionProps {
  children: React.ReactNode;
  onClick?: () => void;
}
interface AlertDialogContentProps {
  children: React.ReactNode;
}
interface AlertDialogDescriptionProps {
  children: React.ReactNode;
}
interface AlertDialogFooterProps {
  children: React.ReactNode;
}
interface AlertDialogHeaderProps {
  children: React.ReactNode;
}
interface AlertDialogTitleProps {
  children: React.ReactNode;
}

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: AlertDialogProps) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogAction: ({ children, onClick }: AlertDialogActionProps) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({ children, onClick }: AlertDialogActionProps) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogContent: ({ children }: AlertDialogContentProps) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: AlertDialogDescriptionProps) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: AlertDialogFooterProps) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: AlertDialogHeaderProps) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: AlertDialogTitleProps) => (
    <div>{children}</div>
  ),
}));

describe("BiddingPanel", () => {
  const mockAuction = {
    _id: "auction123" as Id<"auctions">,
    currentPrice: 50000,
    minIncrement: 500,
    startingPrice: 50000,
    endTime: Date.now() + 100000,
    status: "active",
  } as Doc<"auctions">;

  const mockSession = { user: { id: "test-user-id", name: "Test User" } };

  beforeEach(() => {
    vi.clearAllMocks();
    const mockMut = Object.assign(vi.fn(), {
      withOptimisticUpdate: vi.fn().mockReturnThis(),
    });
    vi.mocked(convexReact.useMutation).mockReturnValue(mockMut);
    const sessionData = { data: mockSession, isPending: false };
    vi.mocked(useSession).mockReturnValue(
      sessionData as unknown as ReturnType<typeof useSession>
    );
    // Default mock for queries
    vi.mocked(convexReact.useQuery).mockReturnValue(null);
  });

  it("renders current price and minimum bid correctly", () => {
    vi.mocked(convexReact.useQuery).mockImplementation((...args: unknown[]) => {
      const apiPath = args[0] as { name?: string };
      if (apiPath?.name === "getMyProfile")
        return { profile: { isVerified: true, kycStatus: "verified" } };
      return null;
    });

    render(
      <BrowserRouter>
        <BiddingPanel auction={mockAuction} />
      </BrowserRouter>
    );

    expect(screen.getByText(/R.*50.000/)).toBeInTheDocument();
    expect(screen.getByText(/Next minimum bid/i)).toBeInTheDocument();
  });

  it("shows ended state when auction is not active", () => {
    const endedAuction = { ...mockAuction, status: "sold" } as Doc<"auctions">;
    render(
      <BrowserRouter>
        <BiddingPanel auction={endedAuction} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Auction SOLD/i)).toBeInTheDocument();
  });

  it("gates bidding UI when user is unverified", () => {
    vi.mocked(convexReact.useQuery).mockImplementation(() => {
      // Handle both string and property access if necessary
      return { profile: { isVerified: false, kycStatus: "none" } };
    });

    render(
      <BrowserRouter>
        <BiddingPanel auction={mockAuction} />
      </BrowserRouter>
    );

    expect(
      screen.getAllByText(/Verification Required/i).length
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows congratulations message when user is the winner", () => {
    const wonAuction = {
      ...mockAuction,
      status: "sold",
      winnerId: "test-user-id",
    } as Doc<"auctions">;

    render(
      <BrowserRouter>
        <BiddingPanel auction={wonAuction} />
      </BrowserRouter>
    );

    expect(
      screen.getByText(/Congratulations, you are the buyer!/i)
    ).toBeInTheDocument();
  });

  it("handles bid confirmation successfully", async () => {
    const mockPlaceBid = Object.assign(
      vi.fn().mockResolvedValue({ success: true }),
      {
        withOptimisticUpdate: vi.fn().mockReturnThis(),
      }
    );
    vi.mocked(convexReact.useMutation).mockReturnValue(
      mockPlaceBid as unknown as ReturnType<typeof convexReact.useMutation>
    );
    vi.mocked(convexReact.useQuery).mockReturnValue({
      profile: { isVerified: true, kycStatus: "verified" },
    });

    render(
      <BrowserRouter>
        <BiddingPanel auction={mockAuction} />
      </BrowserRouter>
    );

    // Place a bid
    // If proxy is enabled by default in the mock, we need to provide a max bid
    const maxBidInput = screen.queryByPlaceholderText(/Enter max amount/i);
    if (maxBidInput) {
      fireEvent.change(maxBidInput, { target: { value: "60000" } });
    }

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    // Check if dialog is open
    await waitFor(() => {
      expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
    });

    expect(screen.getByText(/Confirm your bid/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: "Confirm Bid" });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockPlaceBid).toHaveBeenCalled();
    });
  });

  it("prompts for sign in when unauthenticated", async () => {
    const sessionData = { data: null, isPending: false };
    vi.mocked(useSession).mockReturnValue(
      sessionData as unknown as ReturnType<typeof useSession>
    );
    vi.mocked(convexReact.useQuery).mockReturnValue(null); // No profile

    render(
      <BrowserRouter>
        <BiddingPanel auction={mockAuction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("Please sign in")
    );
  });
});
