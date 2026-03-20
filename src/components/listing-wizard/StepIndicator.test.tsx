import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";

import { StepIndicator } from "./StepIndicator";

vi.mock("@/hooks/listing-wizard/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

type MockUseListingWizard = ReturnType<typeof vi.fn>;

describe("StepIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correct step information", () => {
    (useListingWizard as MockUseListingWizard).mockReturnValue({
      currentStep: 0,
      draftSaved: false,
    });

    render(<StepIndicator />);
    expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/General Information/i)).toBeInTheDocument();
  });

  it("shows draft saved indicator when saved", () => {
    (useListingWizard as MockUseListingWizard).mockReturnValue({
      currentStep: 0,
      draftSaved: true,
    });

    const { container } = render(<StepIndicator />);
    const savedIndicator = container.querySelector(".opacity-100");
    expect(savedIndicator).toBeInTheDocument();
    expect(screen.getByText(/Draft Saved/i)).toBeInTheDocument();
  });

  it("hides draft saved indicator when not saved", () => {
    (useListingWizard as MockUseListingWizard).mockReturnValue({
      currentStep: 0,
      draftSaved: false,
    });

    const { container } = render(<StepIndicator />);
    const savedIndicator = container.querySelector(".opacity-0");
    expect(savedIndicator).toBeInTheDocument();
  });

  it("has correct progress bar attributes", () => {
    (useListingWizard as MockUseListingWizard).mockReturnValue({
      currentStep: 2, // Step 3
      draftSaved: false,
    });

    render(<StepIndicator />);
    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "3");
    expect(progressBar).toHaveAttribute("aria-valuemax", "6");
  });
});
