import { beforeEach, describe, it, expect, vi } from "vitest";
import type { ReactNode, ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import type { KycReviewUser } from "@/hooks/admin/useUserManagement";

import { KycReviewDialog } from "./KycReviewDialog";

const protectedDocument = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useDocumentPreview", () => ({
  useProtectedDocument: protectedDocument,
}));

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
    kycDocumentCount: 2,
  };

  beforeEach(() => {
    protectedDocument.mockReset().mockReturnValue({
      isPdf: false,
      loading: false,
      src: "blob:thumb",
      href: "blob:full",
    });
  });

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

  it("shows one link per legacy file, read through the protected route", () => {
    render(<KycReviewDialog {...defaultProps} />);

    const links = screen.getAllByRole("link", { name: /View Document/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "blob:full");
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
    expect(protectedDocument).toHaveBeenCalledWith({
      kind: "legacy",
      userId: "user123",
      index: 1,
    });
    // The thumbnail is the object URL, never a storage address.
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", "blob:thumb");
  });

  it("shows an Open PDF link for a PDF", () => {
    protectedDocument.mockReturnValue({
      isPdf: true,
      loading: false,
      href: "blob:pdf",
    });
    render(<KycReviewDialog {...defaultProps} />);
    expect(screen.getAllByRole("link", { name: /Open PDF/ })).toHaveLength(2);
  });

  it("shows a loading line while a file is fetched", () => {
    protectedDocument.mockReturnValue({ isPdf: false, loading: true });
    render(<KycReviewDialog {...defaultProps} />);
    expect(screen.getByText(/Loading document 1/)).toBeInTheDocument();
  });

  it("shows the reason when a file can't be loaded", () => {
    protectedDocument.mockReturnValue({
      isPdf: false,
      loading: false,
      error: "That document isn't available.",
    });
    render(<KycReviewDialog {...defaultProps} />);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "Document 1: That document isn't available."
    );
  });

  it("falls back to a generic reason when there is no error text", () => {
    protectedDocument.mockReturnValue({ isPdf: false, loading: false });
    render(<KycReviewDialog {...defaultProps} />);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "Couldn't load that document."
    );
  });

  it("should display message when no documents uploaded", () => {
    const userWithoutDocs = { ...mockUser, kycDocumentCount: 0 };
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

  it("should display message when kycDocumentCount is undefined", () => {
    const userWithoutDocs = { ...mockUser, kycDocumentCount: undefined };
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
