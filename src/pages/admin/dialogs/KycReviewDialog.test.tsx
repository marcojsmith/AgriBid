import { describe, it, expect, vi } from "vitest";
import type { ReactNode, ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import type { KycReviewUser } from "@/hooks/admin/useUserManagement";

import { KycReviewDialog } from "./KycReviewDialog";

type DialogProps = ComponentProps<"div"> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open, onOpenChange }: DialogProps) => (
    <div
      data-testid="mock-dialog"
      data-open={open}
      onClick={() => onOpenChange?.(false)}
    >
      {children}
    </div>
  ),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("KycReviewDialog", () => {
  const mockUser: KycReviewUser = {
    userId: "user123",
    firstName: "John",
    lastName: "Doe",
    idNumber: "1234567890",
    phoneNumber: "+1234567890",
    kycEmail: "john@example.com",
    kycDocumentUrls: [
      "https://example.com/doc1.pdf",
      "https://example.com/doc2.pdf",
    ],
  };

  const defaultProps = {
    user: mockUser,
    isOpen: true,
    onClose: vi.fn(),
    onReview: vi.fn(),
    isProcessing: false,
    rejectionReason: "",
    setRejectionReason: vi.fn(),
    showFullId: false,
    setShowFullId: vi.fn(),
  };

  it("should render the dialog when open with a user", () => {
    render(<KycReviewDialog {...defaultProps} />);

    expect(screen.getByText("KYC Verification Review")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("+1234567890")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("should not render content when user is null", () => {
    render(<KycReviewDialog {...defaultProps} user={null} />);

    expect(screen.getByText("KYC Verification Review")).toBeInTheDocument();
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("should display masked ID when showFullId is false", () => {
    render(<KycReviewDialog {...defaultProps} showFullId={false} />);

    expect(screen.getByText("****7890")).toBeInTheDocument();
  });

  it("should display full ID when showFullId is true", () => {
    render(<KycReviewDialog {...defaultProps} showFullId={true} />);

    expect(screen.getByText("1234567890")).toBeInTheDocument();
  });

  it("should toggle ID visibility when reveal button is clicked", () => {
    const setShowFullId = vi.fn();
    render(<KycReviewDialog {...defaultProps} setShowFullId={setShowFullId} />);

    const revealButton = screen.getByText("Reveal");
    fireEvent.click(revealButton);

    expect(setShowFullId).toHaveBeenCalledWith(true);
  });

  it("should display document URLs", () => {
    render(<KycReviewDialog {...defaultProps} />);

    expect(screen.getByText("View Document 1")).toBeInTheDocument();
    expect(screen.getByText("View Document 2")).toBeInTheDocument();
  });

  it("should open document URL in new window when View Document is clicked", () => {
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    render(<KycReviewDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("View Document 1"));

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://example.com/doc1.pdf",
      "_blank",
      "noopener,noreferrer"
    );
    windowOpenSpy.mockRestore();
  });

  it("should display message when no documents uploaded", () => {
    const userWithoutDocs = { ...mockUser, kycDocumentUrls: [] };
    render(<KycReviewDialog {...defaultProps} user={userWithoutDocs} />);

    expect(screen.getByText("No documents uploaded.")).toBeInTheDocument();
  });

  it("should handle missing firstName or lastName", () => {
    const userWithMissingName = { ...mockUser, firstName: "", lastName: "" };
    render(<KycReviewDialog {...defaultProps} user={userWithMissingName} />);

    expect(screen.getByText("—")).toBeInTheDocument(); // Fallback for empty name
  });

  it("should handle missing idNumber when showFullId is true", () => {
    const userWithMissingId = { ...mockUser, idNumber: "" };
    render(
      <KycReviewDialog
        {...defaultProps}
        user={userWithMissingId}
        showFullId={true}
      />
    );

    expect(screen.getByText("Not Provided")).toBeInTheDocument();
  });

  it("should handle missing idNumber when showFullId is false", () => {
    const userWithMissingId = { ...mockUser, idNumber: "" };
    render(
      <KycReviewDialog
        {...defaultProps}
        user={userWithMissingId}
        showFullId={false}
      />
    );

    expect(screen.getByText("Not Provided")).toBeInTheDocument();
  });

  it("should handle missing phoneNumber", () => {
    const userWithMissingPhone = { ...mockUser, phoneNumber: "" };
    render(<KycReviewDialog {...defaultProps} user={userWithMissingPhone} />);

    expect(screen.getByText("Not Provided")).toBeInTheDocument();
  });

  it("should handle missing kycEmail", () => {
    const userWithMissingEmail = { ...mockUser, kycEmail: "" };
    render(<KycReviewDialog {...defaultProps} user={userWithMissingEmail} />);

    expect(screen.getByText("Not Provided")).toBeInTheDocument();
  });

  it("should call onReview with 'approve' when Approve button is clicked", () => {
    render(<KycReviewDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("Approve & Verify"));

    expect(defaultProps.onReview).toHaveBeenCalledWith("approve");
  });

  it("should call onReview with 'reject' when Reject button is clicked", () => {
    render(
      <KycReviewDialog {...defaultProps} rejectionReason="Invalid document" />
    );

    fireEvent.click(screen.getByText("Reject Application"));

    expect(defaultProps.onReview).toHaveBeenCalledWith("reject");
  });

  it("should disable Reject button when rejection reason is empty", () => {
    render(<KycReviewDialog {...defaultProps} rejectionReason="" />);

    const rejectButton = screen
      .getByText("Reject Application")
      .closest("button");
    expect(rejectButton?.disabled).toBe(true);
  });

  it("should enable Reject button when rejection reason is provided", () => {
    render(
      <KycReviewDialog {...defaultProps} rejectionReason="Invalid document" />
    );

    const rejectButton = screen
      .getByText("Reject Application")
      .closest("button");
    expect(rejectButton?.disabled).toBe(false);
  });

  it("should update rejection reason when textarea changes", () => {
    const setRejectionReason = vi.fn();
    render(
      <KycReviewDialog
        {...defaultProps}
        setRejectionReason={setRejectionReason}
      />
    );

    const textarea = screen.getByPlaceholderText(
      "e.g. Documents are blurry or ID number doesn't match..."
    );
    fireEvent.change(textarea, { target: { value: "Invalid document" } });

    expect(setRejectionReason).toHaveBeenCalledWith("Invalid document");
  });

  it("should show loading indicators when processing", () => {
    render(<KycReviewDialog {...defaultProps} isProcessing={true} />);

    // Check for loading indicators (there should be 2 - one for each button)
    const loadingIndicators = screen.getAllByRole("status");
    expect(loadingIndicators.length).toBeGreaterThanOrEqual(1);
  });

  it("should disable action buttons when processing", () => {
    render(<KycReviewDialog {...defaultProps} isProcessing={true} />);

    const approveButton = screen
      .getByText("Approve & Verify")
      .closest("button");
    const rejectButton = screen
      .getByText("Reject Application")
      .closest("button");

    expect(approveButton?.disabled).toBe(true);
    expect(rejectButton?.disabled).toBe(true);
  });

  it("should display message when kycDocumentUrls is undefined", () => {
    const userWithoutDocs = { ...mockUser, kycDocumentUrls: undefined };
    render(<KycReviewDialog {...defaultProps} user={userWithoutDocs} />);

    expect(screen.getByText("No documents uploaded.")).toBeInTheDocument();
  });

  it("should handle undefined idNumber when showFullId is true", () => {
    const userWithNoId = { ...mockUser, idNumber: undefined };
    render(
      <KycReviewDialog
        {...defaultProps}
        user={userWithNoId}
        showFullId={true}
      />
    );

    expect(screen.getByText("Not Provided")).toBeInTheDocument();
  });

  it("should call onClose when onOpenChange(false) is triggered", () => {
    render(<KycReviewDialog {...defaultProps} />);

    // Clicking the mock dialog triggers onOpenChange(false)
    fireEvent.click(screen.getByTestId("mock-dialog"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
