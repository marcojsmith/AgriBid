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
vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

// Mock Radix Alert Dialog
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: any) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
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
    vi.mocked(convexReact.useMutation).mockReturnValue(vi.fn());
    vi.mocked(useSession).mockReturnValue({
      data: mockSession,
      isPending: false,
    } as any);
    // Default mock for queries
    vi.mocked(convexReact.useQuery).mockReturnValue(null);
  });

  it("renders current price and minimum bid correctly", () => {
    vi.mocked(convexReact.useQuery).mockImplementation((apiPath: any) => {
      if (apiPath?.name === "getMyProfile") return { profile: { isVerified: true, kycStatus: "verified" } };
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
    vi.mocked(convexReact.useQuery).mockImplementation((apiPath: any) => {
      // Handle both string and property access if necessary
      return { profile: { isVerified: false, kycStatus: "none" } };
    });

    render(
      <BrowserRouter>
        <BiddingPanel auction={mockAuction} />
      </BrowserRouter>
    );

    expect(screen.getAllByText(/Verification Required/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows congratulations message when user is the winner", () => {
    const wonAuction = { 
      ...mockAuction, 
      status: "sold", 
      winnerId: "test-user-id" 
    } as Doc<"auctions">;

    render(
      <BrowserRouter>
        <BiddingPanel auction={wonAuction} />
      </BrowserRouter>
    );

    expect(screen.getByText(/Congratulations, you are the buyer!/i)).toBeInTheDocument();
  });

  it("handles bid confirmation successfully", async () => {
    const mockPlaceBid = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(convexReact.useMutation).mockReturnValue(mockPlaceBid);
    vi.mocked(convexReact.useQuery).mockReturnValue({ profile: { isVerified: true, kycStatus: "verified" } });

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
    vi.mocked(useSession).mockReturnValue({
      data: null,
      isPending: false,
    } as any);
    vi.mocked(convexReact.useQuery).mockReturnValue(null); // No profile

    render(
      <BrowserRouter>
        <BiddingPanel auction={mockAuction} />
      </BrowserRouter>
    );

    const bidButton = screen.getByRole("button", { name: /Place Bid/i });
    fireEvent.click(bidButton);
    
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Please sign in"));
  });
});
