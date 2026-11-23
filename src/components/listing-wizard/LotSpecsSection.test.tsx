import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";

import { LotSpecsSection } from "./LotSpecsSection";
import type { ListingFormData } from "./types";
import type { ListingWizardContextType } from "./context/ListingWizardContextDef";

vi.mock("@/hooks/listing-wizard/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

describe("LotSpecsSection", () => {
  const setFormData = vi.fn();
  const setDraftSaved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useListingWizard).mockReturnValue({
      formData: { powerKw: 90 } as unknown as ListingFormData,
      setFormData,
      setDraftSaved,
    } as unknown as ListingWizardContextType);
  });

  it("shows the optional specs heading and current values", () => {
    render(<LotSpecsSection />);
    expect(
      screen.getByRole("heading", { name: "Specs (optional)" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Power (kW)")).toHaveValue(90);
  });

  it("merges a changed field into the form data", () => {
    render(<LotSpecsSection />);
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "SN7" },
    });
    expect(setDraftSaved).toHaveBeenCalledWith(false);
    const updater = setFormData.mock.calls[0][0] as (
      prev: ListingFormData
    ) => ListingFormData;
    expect(updater({ powerKw: 90 } as ListingFormData)).toEqual({
      powerKw: 90,
      serialNumber: "SN7",
    });
  });
});
