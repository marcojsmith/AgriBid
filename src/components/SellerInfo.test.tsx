import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as convexReact from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { toast } from "sonner";

import { SellerInfo } from "./SellerInfo";

// Mock Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Dialog component (same pattern as Profile.test.tsx / AuctionDetail.test.tsx)
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (o: boolean) => void;
  }) => (
    <div data-testid="dialog-root">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(
            child as React.ReactElement<{
              open?: boolean;
              onOpenChange?: (o: boolean) => void;
            }>,
            {
              open,
              onOpenChange,
            }
          );
        }
        return child;
      })}
    </div>
  ),
  DialogTrigger: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode;
    onOpenChange?: (o: boolean) => void;
  }) => (
    <div
      onClick={() => onOpenChange && onOpenChange(true)}
      data-testid="dialog-trigger"
    >
      {children}
    </div>
  ),
  DialogContent: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div data-testid="dialog-content">{children}</div> : null),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockSeller = {
  name: "Verified Farmer",
  isVerified: true,
  role: "Commercial Dealer",
  createdAt: Date.now() - 31536000000, // 1 year ago
  itemsSold: 15,
};

interface SellerInfoTestProps {
  auctionId?: string;
  isOwnListing?: boolean;
}

const renderSellerInfo = ({
  auctionId,
  isOwnListing,
}: SellerInfoTestProps = {}) => {
  return render(
    <MemoryRouter initialEntries={["/auction/auction1"]}>
      <Routes>
        <Route
          path="/auction/:id"
          element={
            <SellerInfo
              sellerId="seller123"
              auctionId={auctionId as Id<"auctions"> | undefined}
              isOwnListing={isOwnListing}
            />
          }
        />
        <Route
          path="/messages/:conversationId"
          element={<div data-testid="messages-thread">Thread</div>}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("SellerInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(convexReact.useQuery).mockReturnValue(mockSeller);
  });

  it("renders seller details correctly when verified", () => {
    renderSellerInfo();

    expect(screen.getByText("Verified Farmer")).toBeInTheDocument();
    expect(screen.getByText("Commercial Dealer")).toBeInTheDocument();
    expect(
      screen.getByText(/High-Integrity Verification/i)
    ).toBeInTheDocument();
  });

  it("shows skeleton UI when loading", () => {
    vi.mocked(convexReact.useQuery).mockReturnValue(undefined);

    const { container } = renderSellerInfo();

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows unavailable message when seller is null", () => {
    vi.mocked(convexReact.useQuery).mockReturnValue(null);

    renderSellerInfo();

    expect(
      screen.getByText(/Seller information unavailable/i)
    ).toBeInTheDocument();
  });

  it("hides verification badge when seller is unverified", () => {
    vi.mocked(convexReact.useQuery).mockReturnValue({
      name: "Unverified User",
      isVerified: false,
      role: "Buyer",
      createdAt: Date.now(),
      itemsSold: 0,
    });

    renderSellerInfo();

    expect(screen.getByText("Unverified User")).toBeInTheDocument();
    expect(
      screen.queryByText(/High-Integrity Verification/i)
    ).not.toBeInTheDocument();
  });

  describe("Message dialog", () => {
    it("renders an enabled Message button without the not-implemented label", () => {
      renderSellerInfo();

      const messageBtn = screen.getByRole("button", {
        name: "Message Verified Farmer",
      });

      expect(messageBtn).toBeEnabled();
      expect(messageBtn.getAttribute("aria-label")).not.toContain(
        "Not implemented"
      );
    });

    it("opens the message dialog with a message field and send button", () => {
      renderSellerInfo();

      fireEvent.click(
        screen.getByRole("button", { name: /message verified farmer/i })
      );

      expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
      expect(screen.getByText("Send a message to start a conversation"));
      expect(screen.getByLabelText(/^message$/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /send message/i })
      ).toBeInTheDocument();
    });

    it("closes the dialog on cancel", () => {
      renderSellerInfo();

      fireEvent.click(
        screen.getByRole("button", { name: /message verified farmer/i })
      );
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(screen.queryByTestId("dialog-content")).not.toBeInTheDocument();
    });

    it("shows an error toast and does not call the mutation when submitting without a message", () => {
      const mockStartConversation = vi.fn();
      vi.mocked(convexReact.useMutation as Mock).mockReturnValue(
        mockStartConversation
      );

      renderSellerInfo();

      fireEvent.click(
        screen.getByRole("button", { name: /message verified farmer/i })
      );
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      expect(toast.error).toHaveBeenCalledWith("Please enter a message");
      expect(mockStartConversation).not.toHaveBeenCalled();
    });

    it("starts a conversation with the auction linked and navigates to the thread on success", async () => {
      const mockStartConversation = vi.fn().mockResolvedValue("conv_new_123");
      vi.mocked(convexReact.useMutation as Mock).mockReturnValue(
        mockStartConversation
      );

      renderSellerInfo({ auctionId: "auction1" });

      fireEvent.click(
        screen.getByRole("button", { name: /message verified farmer/i })
      );
      fireEvent.change(screen.getByLabelText(/^message$/i), {
        target: { value: "Hi, is the tractor still available?" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => {
        expect(mockStartConversation).toHaveBeenCalledWith({
          recipientId: "seller123",
          initialMessage: "Hi, is the tractor still available?",
          auctionId: "auction1",
        });
        expect(toast.success).toHaveBeenCalledWith("Message sent");
        expect(screen.getByTestId("messages-thread")).toBeInTheDocument();
      });
    });

    it("omits auctionId when none is provided", async () => {
      const mockStartConversation = vi.fn().mockResolvedValue("conv_new_123");
      vi.mocked(convexReact.useMutation as Mock).mockReturnValue(
        mockStartConversation
      );

      renderSellerInfo();

      fireEvent.click(
        screen.getByRole("button", { name: /message verified farmer/i })
      );
      fireEvent.change(screen.getByLabelText(/^message$/i), {
        target: { value: "Hello" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => {
        expect(mockStartConversation).toHaveBeenCalledWith({
          recipientId: "seller123",
          initialMessage: "Hello",
          auctionId: undefined,
        });
      });
    });

    it("trims whitespace-only messages to empty and rejects submission", () => {
      const mockStartConversation = vi.fn();
      vi.mocked(convexReact.useMutation as Mock).mockReturnValue(
        mockStartConversation
      );

      renderSellerInfo();

      fireEvent.click(
        screen.getByRole("button", { name: /message verified farmer/i })
      );
      fireEvent.change(screen.getByLabelText(/^message$/i), {
        target: { value: "   " },
      });
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      expect(toast.error).toHaveBeenCalledWith("Please enter a message");
      expect(mockStartConversation).not.toHaveBeenCalled();
    });

    it("shows an error toast, keeps the dialog open and stays on the page when the mutation fails", async () => {
      const mockStartConversation = vi
        .fn()
        .mockRejectedValue(new Error("You cannot message yourself"));
      vi.mocked(convexReact.useMutation as Mock).mockReturnValue(
        mockStartConversation
      );

      renderSellerInfo();

      fireEvent.click(
        screen.getByRole("button", { name: /message verified farmer/i })
      );
      fireEvent.change(screen.getByLabelText(/^message$/i), {
        target: { value: "Hello" },
      });
      fireEvent.click(screen.getByRole("button", { name: /send message/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("You cannot message yourself");
      });
      expect(screen.queryByTestId("dialog-content")).toBeInTheDocument();
      expect(screen.queryByTestId("messages-thread")).not.toBeInTheDocument();
    });

    it("disables the Message button with an own-listing label when isOwnListing is true", () => {
      renderSellerInfo({ isOwnListing: true });

      const messageBtn = screen.getByRole("button", {
        name: "This is your own listing",
      });

      expect(messageBtn).toBeDisabled();
      expect(messageBtn).toHaveAttribute("title", "This is your own listing");
    });
  });
});
