import { beforeEach, describe, it, expect, vi } from "vitest";
import type { ReactNode, ComponentProps } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type {
  KycReviewUser,
  RegistrationReview,
} from "@/hooks/admin/useUserManagement";

import { KycReviewDialog } from "./KycReviewDialog";

const protectedDocument = vi.hoisted(() => vi.fn());
const documentPreview = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useDocumentPreview", () => ({
  useProtectedDocument: protectedDocument,
  useDocumentPreview: documentPreview,
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

type ReviewDetails = RegistrationReview["details"];
type ReviewDoc = RegistrationReview["documents"][number];

/**
 * Builds review details; the server type lists every optional key.
 *
 * @param over - Fields to set
 * @returns The details
 */
function details(over: Partial<ReviewDetails>): ReviewDetails {
  return {
    idType: undefined,
    fullName: undefined,
    phoneNumber: undefined,
    idNumber: undefined,
    passportNumber: undefined,
    countryOfIssue: undefined,
    streetAddress: undefined,
    town: undefined,
    postalCode: undefined,
    ...over,
  };
}

/**
 * Builds a review document; the server type lists every optional key.
 *
 * @param over - Fields to set (id, kind, status, fileName, fileSize, uploadedAt are required)
 * @returns The document
 */
function reviewDoc(
  over: Pick<ReviewDoc, "kind" | "status" | "fileName" | "fileSize"> &
    Partial<Omit<ReviewDoc, "id">> & { id: string }
): ReviewDoc {
  return {
    contentType: undefined,
    uploadedAt: 1,
    rejectionReason: undefined,
    reviewedAt: undefined,
    ...over,
    id: over.id as ReviewDoc["id"],
  };
}

describe("KycReviewDialog: per-document registration review", () => {
  const registration: RegistrationReview = {
    details: details({
      idType: "sa_id",
      fullName: "Thandi Nkosi",
      phoneNumber: "+27825550147",
      idNumber: "8001015009087",
      streetAddress: "12 Church Street",
      town: "Malmesbury",
      postalCode: "7300",
    }),
    documents: [
      reviewDoc({
        id: "doc-front",
        kind: "id_front",
        status: "pending",
        fileName: "front.jpg",
        fileSize: 245_000,
        contentType: "image/jpeg",
        uploadedAt: 1,
      }),
      reviewDoc({
        id: "doc-back",
        kind: "id_back",
        status: "rejected",
        fileName: "back.pdf",
        fileSize: 2_000_000,
        contentType: "application/pdf",
        uploadedAt: 1,
        rejectionReason: "Photo is blurry",
        reviewedAt: Date.UTC(2026, 10, 20),
      }),
      reviewDoc({
        id: "doc-addr",
        kind: "proof_of_address",
        status: "approved",
        fileName: "bill.jpg",
        fileSize: 100,
        uploadedAt: 1,
        reviewedAt: Date.UTC(2026, 10, 21),
      }),
    ],
    deposit: {
      reference: "AB-7K3F2",
      status: "paid_claimed",
      amount: 5000,
      paidClaimedAt: undefined,
      receivedAt: undefined,
      receivedAmount: undefined,
      refundedAt: undefined,
    },
    submittedAt: undefined,
    legacy: false,
  };

  const onReviewDocument = vi.fn();
  const props = {
    user: { userId: "u1", kycDocumentCount: 0 } satisfies KycReviewUser,
    isOpen: true,
    onClose: vi.fn(),
    onReview: vi.fn(),
    isProcessing: false,
    rejectionReason: "",
    setRejectionReason: vi.fn(),
    showFullId: false,
    setShowFullId: vi.fn(),
    registration,
    onReviewDocument,
  };

  beforeEach(() => {
    onReviewDocument.mockReset().mockResolvedValue(true);
    documentPreview
      .mockReset()
      .mockImplementation((doc: { contentType: string }) =>
        doc.contentType === "application/pdf"
          ? { isPdf: true, loading: false, href: "blob:pdf" }
          : {
              isPdf: false,
              loading: false,
              src: "blob:img",
              href: "blob:full",
            }
      );
  });

  it("shows the details, one card per document and the deposit, not the legacy buttons", () => {
    render(<KycReviewDialog {...props} />);

    expect(screen.getByText("Thandi Nkosi")).toBeInTheDocument();
    expect(screen.getByText("South African ID")).toBeInTheDocument();
    expect(screen.getByText("****9087")).toBeInTheDocument();
    expect(
      screen.getByText("12 Church Street, Malmesbury, 7300")
    ).toBeInTheDocument();
    expect(screen.getByText("ID front")).toBeInTheDocument();
    expect(screen.getByText("ID back")).toBeInTheDocument();
    expect(screen.getByText("Proof of address")).toBeInTheDocument();
    expect(screen.getByText("AB-7K3F2")).toBeInTheDocument();
    expect(screen.queryByText("Approve & Verify")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject Application")).not.toBeInTheDocument();
    // Previews come from the protected hook; nothing here is a storage URL.
    expect(documentPreview).toHaveBeenCalledWith(
      expect.objectContaining({ id: "doc-front" })
    );
  });

  it("previews an image and opens a PDF in a new tab", () => {
    render(<KycReviewDialog {...props} />);
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", "blob:img");
    const pdf = screen.getByRole("link", { name: /Open ID back PDF/ });
    expect(pdf).toHaveAttribute("href", "blob:pdf");
    expect(pdf).toHaveAttribute("target", "_blank");
    expect(pdf).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows status pills, the existing reason and the reviewed date", () => {
    render(<KycReviewDialog {...props} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText(/Photo is blurry/)).toBeInTheDocument();
    expect(screen.getByText(/Approved on/)).toBeInTheDocument();
  });

  it("approves one document", async () => {
    render(<KycReviewDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve ID front" }));
    await waitFor(() => {
      expect(onReviewDocument).toHaveBeenCalledWith(
        registration.documents[0],
        "approve"
      );
    });
    // An already approved document can't be approved again.
    expect(
      screen.getByRole("button", { name: "Approve Proof of address" })
    ).toBeDisabled();
  });

  it("requires a reason before a rejection can be confirmed", async () => {
    render(<KycReviewDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject ID front" }));

    const confirm = screen.getByRole("button", {
      name: "Confirm reject ID front",
    });
    expect(confirm).toBeDisabled();
    const reason = screen.getByLabelText("Reason for rejecting ID front");
    expect(reason).toHaveAttribute("maxlength", "300");

    fireEvent.change(reason, { target: { value: "   " } });
    expect(confirm).toBeDisabled();
    fireEvent.change(reason, { target: { value: "Cropped at the edge" } });
    expect(screen.getByText("19/300")).toBeInTheDocument();
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    await waitFor(() => {
      expect(onReviewDocument).toHaveBeenCalledWith(
        registration.documents[0],
        "reject",
        "Cropped at the edge"
      );
    });
    // Saved: the reason form closes again.
    await waitFor(() => {
      expect(
        screen.queryByLabelText("Reason for rejecting ID front")
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the reason form open when the rejection fails, and can cancel", async () => {
    onReviewDocument.mockResolvedValue(false);
    render(<KycReviewDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject ID front" }));
    fireEvent.change(screen.getByLabelText("Reason for rejecting ID front"), {
      target: { value: "Blurry" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm reject ID front" })
    );
    await waitFor(() => {
      expect(onReviewDocument).toHaveBeenCalled();
    });
    expect(screen.getByLabelText("Reason for rejecting ID front")).toHaveValue(
      "Blurry"
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByLabelText("Reason for rejecting ID front")
    ).not.toBeInTheDocument();
  });

  it("disables every action while a decision is saving", () => {
    render(<KycReviewDialog {...props} isProcessing={true} />);
    for (const name of [
      "Approve ID front",
      "Reject ID front",
      "Reject ID back",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("reveals the full number and shows passport details", () => {
    const setShowFullId = vi.fn();
    render(
      <KycReviewDialog
        {...props}
        setShowFullId={setShowFullId}
        registration={{
          ...registration,
          details: details({
            idType: "passport",
            passportNumber: "AB123456",
            countryOfIssue: "Zimbabwe",
          }),
          documents: [],
          deposit: null,
        }}
      />
    );
    expect(screen.getByText("Passport")).toBeInTheDocument();
    expect(screen.getByText("Zimbabwe")).toBeInTheDocument();
    expect(screen.getByText("****3456")).toBeInTheDocument();
    expect(screen.getByText("No documents uploaded.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    expect(setShowFullId).toHaveBeenCalledWith(true);
  });

  it("shows loading and error states for a file", () => {
    documentPreview.mockReturnValue({ isPdf: false, loading: true });
    const { rerender } = render(<KycReviewDialog {...props} />);
    expect(screen.getAllByText(/Loading ID front/)).toHaveLength(1);

    documentPreview.mockReturnValue({
      isPdf: false,
      loading: false,
      error: "That document isn't available.",
    });
    rerender(<KycReviewDialog {...props} />);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "ID front: That document isn't available."
    );

    documentPreview.mockReturnValue({ isPdf: false, loading: false });
    rerender(<KycReviewDialog {...props} />);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "Couldn't load that document."
    );
  });

  it("falls back to the legacy view when there is no registration", () => {
    render(<KycReviewDialog {...props} registration={null} />);
    expect(screen.getByText("Approve & Verify")).toBeInTheDocument();
  });
});
