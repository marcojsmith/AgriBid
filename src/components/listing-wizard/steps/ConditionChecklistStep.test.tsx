import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";

import { ConditionChecklistStep } from "./ConditionChecklistStep";
import type { ListingFormData } from "../types";
import type { ListingWizardContextType } from "../context/ListingWizardContextDef";

vi.mock("@/hooks/listing-wizard/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

describe("ConditionChecklistStep", () => {
  const mockUpdateChecklist = vi.fn();
  const mockFormData = {
    conditionChecklist: {
      engine: undefined,
      hydraulics: undefined,
      tires: undefined,
      serviceHistory: undefined,
      notes: "",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useListingWizard).mockReturnValue({
      formData: mockFormData as unknown as ListingFormData,
      updateChecklist: mockUpdateChecklist,
    } as unknown as ListingWizardContextType);
  });

  it("renders all checklist items", () => {
    render(<ConditionChecklistStep />);
    expect(screen.getByText("Engine Condition")).toBeInTheDocument();
    expect(screen.getByText("Hydraulic System")).toBeInTheDocument();
    expect(screen.getByText("Tires / Tracks")).toBeInTheDocument();
    expect(screen.getByText("Service History")).toBeInTheDocument();
  });

  it("calls updateChecklist when Yes is clicked", () => {
    render(<ConditionChecklistStep />);
    const yesButtons = screen.getAllByText("Yes");
    fireEvent.click(yesButtons[0]);
    expect(mockUpdateChecklist).toHaveBeenCalledWith("engine", true);
  });

  it("calls updateChecklist when No is clicked", () => {
    render(<ConditionChecklistStep />);
    const noButtons = screen.getAllByText("No");
    fireEvent.click(noButtons[1]);
    expect(mockUpdateChecklist).toHaveBeenCalledWith("hydraulics", false);
  });

  it("updates notes field", () => {
    render(<ConditionChecklistStep />);
    const textarea = screen.getByPlaceholderText(/Mention any recent repairs/i);
    fireEvent.change(textarea, { target: { value: "Regularly serviced" } });
    expect(mockUpdateChecklist).toHaveBeenCalledWith(
      "notes",
      "Regularly serviced"
    );
  });

  it("highlights selected options", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        conditionChecklist: {
          ...mockFormData.conditionChecklist,
          engine: true,
          hydraulics: false,
        } as unknown as ListingFormData,
      } as unknown as ListingFormData,
      updateChecklist: mockUpdateChecklist,
    } as unknown as ListingWizardContextType);

    render(<ConditionChecklistStep />);

    const engineYes = screen.getByLabelText(/Engine Condition yes/i);
    const hydraulicsNo = screen.getByLabelText(/Hydraulic System no/i);

    expect(engineYes).toHaveAttribute("aria-pressed", "true");
    expect(hydraulicsNo).toHaveAttribute("aria-pressed", "true");
  });
});
