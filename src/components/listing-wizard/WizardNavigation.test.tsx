import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";
import { useListingForm } from "@/hooks/listing-wizard/useListingForm";

import { WizardNavigation } from "./WizardNavigation";
import type { ListingWizardContextType } from "./context/ListingWizardContextDef";

vi.mock("@/hooks/listing-wizard/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

vi.mock("@/hooks/listing-wizard/useListingForm", () => ({
  useListingForm: vi.fn(),
}));

describe("WizardNavigation", () => {
  const mockPrev = vi.fn();
  const mockNext = vi.fn();
  const mockGetStepError = vi.fn();
  const mockOnFinalSubmit = vi.fn();
  const mockOnSaveDraft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useListingWizard).mockReturnValue({
      currentStep: 0,
      isSubmitting: false,
      draftSaved: false,
    } as unknown as ListingWizardContextType);
    vi.mocked(useListingForm).mockReturnValue({
      prev: mockPrev,
      next: mockNext,
      getStepError: mockGetStepError,
    } as unknown as ReturnType<typeof useListingForm>);
    mockGetStepError.mockReturnValue(null);
  });

  it("renders Previous and Next Step buttons on first step", () => {
    render(
      <WizardNavigation
        onFinalSubmit={mockOnFinalSubmit}
        onSaveDraft={mockOnSaveDraft}
      />
    );

    expect(screen.getByText(/Previous/i)).toBeDisabled();
    expect(screen.getByText(/Next Step/i)).toBeInTheDocument();
    expect(screen.getByText(/Save Draft/i)).toBeInTheDocument();
  });

  it("enables Previous button on middle steps", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      currentStep: 1,
      isSubmitting: false,
      draftSaved: false,
    } as unknown as ListingWizardContextType);

    render(
      <WizardNavigation
        onFinalSubmit={mockOnFinalSubmit}
        onSaveDraft={mockOnSaveDraft}
      />
    );
    expect(screen.getByText(/Previous/i)).not.toBeDisabled();
  });

  it("calls next when Next Step is clicked", () => {
    render(
      <WizardNavigation
        onFinalSubmit={mockOnFinalSubmit}
        onSaveDraft={mockOnSaveDraft}
      />
    );
    fireEvent.click(screen.getByText(/Next Step/i));
    expect(mockNext).toHaveBeenCalled();
  });

  it("disables Next Step button if step has error", () => {
    mockGetStepError.mockReturnValue("Error");
    render(
      <WizardNavigation
        onFinalSubmit={mockOnFinalSubmit}
        onSaveDraft={mockOnSaveDraft}
      />
    );
    expect(screen.getByText(/Next Step/i)).toBeDisabled();
  });

  it("renders Submit Listing button on last step", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      currentStep: 5, // Last step (index 5 for 6 steps)
      isSubmitting: false,
      draftSaved: false,
    } as unknown as ListingWizardContextType);

    render(
      <WizardNavigation
        onFinalSubmit={mockOnFinalSubmit}
        onSaveDraft={mockOnSaveDraft}
      />
    );
    expect(screen.getByText(/Submit Listing/i)).toBeInTheDocument();
  });

  it("calls onFinalSubmit on last step", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      currentStep: 5,
      isSubmitting: false,
      draftSaved: false,
    } as unknown as ListingWizardContextType);

    render(
      <WizardNavigation
        onFinalSubmit={mockOnFinalSubmit}
        onSaveDraft={mockOnSaveDraft}
      />
    );
    fireEvent.click(screen.getByText(/Submit Listing/i));
    expect(mockOnFinalSubmit).toHaveBeenCalled();
  });

  it("shows Saved state for draft", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      currentStep: 0,
      isSubmitting: false,
      draftSaved: true,
    } as unknown as ListingWizardContextType);

    render(
      <WizardNavigation
        onFinalSubmit={mockOnFinalSubmit}
        onSaveDraft={mockOnSaveDraft}
      />
    );
    expect(screen.getByText(/Saved/i)).toBeInTheDocument();
  });

  it("shows submitting state on final submit", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      currentStep: 5,
      isSubmitting: true,
      draftSaved: false,
    } as unknown as ListingWizardContextType);

    render(
      <WizardNavigation
        onFinalSubmit={mockOnFinalSubmit}
        onSaveDraft={mockOnSaveDraft}
      />
    );
    expect(screen.getByText(/Submitting.../i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submitting/i })).toBeDisabled();
  });
});
