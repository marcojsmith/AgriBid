import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";

import {
  VerificationStatusSection,
  type KycDetails,
  type VerificationStatus,
} from "./VerificationStatusSection";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("VerificationStatusSection", () => {
  const mockOnEdit = vi.fn();
  const userId = "user123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (
    status: VerificationStatus,
    myKycDetails?: KycDetails | null
  ) =>
    render(
      <MemoryRouter>
        <VerificationStatusSection
          status={status}
          myKycDetails={myKycDetails}
          userId={userId}
          onEdit={mockOnEdit}
        />
      </MemoryRouter>
    );

  it("renders loading state when status is verified but details are missing", () => {
    renderComponent("verified", null);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders verified state with full details and documents", () => {
    const details: KycDetails = {
      firstName: "John",
      lastName: "Doe",
      kycEmail: "john@example.com",
      phoneNumber: "1234567890",
      idNumber: "ID12345",
      kycDocumentUrls: ["url1", "url2"],
    };

    renderComponent("verified", details);

    expect(screen.getByText("Identity Verified")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("ID12345")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("1234567890")).toBeInTheDocument();
    expect(screen.getByText("Document 1")).toBeInTheDocument();
    expect(screen.getByText("Document 2")).toBeInTheDocument();
  });

  it("renders verified state with missing optional details", () => {
    const details: KycDetails = {
      firstName: "Jane",
      // lastName missing
      kycEmail: "jane@example.com",
      // idNumber missing
      kycDocumentUrls: [],
    };

    renderComponent("verified", details);

    expect(screen.getByText("Jane")).toBeInTheDocument();
    // ID Number and Phone Number will both show N/A
    expect(screen.getAllByText("N/A")).toHaveLength(2);
    expect(screen.getByText("No documents verified")).toBeInTheDocument();
  });

  it("renders verified state with no name", () => {
    const details: KycDetails = {
      kycEmail: "jane@example.com",
    };

    renderComponent("verified", details);

    expect(screen.getByText("—")).toBeInTheDocument(); // Fallback for name
  });

  it("navigates to public profile when button clicked", () => {
    const details: KycDetails = { firstName: "John" };
    renderComponent("verified", details);

    fireEvent.click(screen.getByText("View Public Profile"));
    expect(mockNavigate).toHaveBeenCalledWith("/profile/user123");
  });

  it("calls onEdit when Edit Details button clicked", () => {
    const details: KycDetails = { firstName: "John" };
    renderComponent("verified", details);

    fireEvent.click(screen.getByText("Edit Details"));
    expect(mockOnEdit).toHaveBeenCalled();
  });

  it("renders pending state", () => {
    renderComponent("pending");

    expect(screen.getByText("Review in Progress")).toBeInTheDocument();
    expect(
      screen.getByText(/Our compliance team is reviewing/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Return to Marketplace"));
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("renders rejected state", () => {
    renderComponent("rejected");

    expect(screen.getByText("Verification Rejected")).toBeInTheDocument();
    expect(
      screen.getByText(/Your identity verification was not approved/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Resubmit Documents"));
    expect(mockOnEdit).toHaveBeenCalled();
  });

  it("returns null for none or unknown status", () => {
    const { container } = renderComponent("none");
    expect(container.firstChild).toBeNull();

    const { container: containerUnknown } = renderComponent("unknown");
    expect(containerUnknown.firstChild).toBeNull();
  });
});
