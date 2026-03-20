import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";

import { PricingDurationStep } from "./PricingDurationStep";

vi.mock("@/hooks/listing-wizard/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

describe("PricingDurationStep", () => {
  const mockUpdateField = vi.fn();
  const mockFormData = {
    startingPrice: 1000,
    reservePrice: 2000,
    durationDays: 7,
    year: 2020,
    make: "John Deere",
    model: "6155R",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useListingWizard as Mock).mockReturnValue({
      formData: mockFormData,
      updateField: mockUpdateField,
    });
  });

  it("renders price inputs and duration buttons", () => {
    render(<PricingDurationStep />);
    expect(screen.getByLabelText(/Starting Price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reserve Price/i)).toBeInTheDocument();
    expect(screen.getByText("3 DAYS")).toBeInTheDocument();
    expect(screen.getByText("7 DAYS")).toBeInTheDocument();
    expect(screen.getByText("14 DAYS")).toBeInTheDocument();
  });

  it("calls updateField on starting price change", () => {
    render(<PricingDurationStep />);
    const input = screen.getByLabelText(/Starting Price/i);
    fireEvent.change(input, { target: { value: "1500" } });
    expect(mockUpdateField).toHaveBeenCalledWith("startingPrice", 1500);
  });

  it("calls updateField with 0 when starting price is cleared", () => {
    render(<PricingDurationStep />);
    const input = screen.getByLabelText(/Starting Price/i);
    fireEvent.change(input, { target: { value: "" } });
    expect(mockUpdateField).toHaveBeenCalledWith("startingPrice", 0);
  });

  it("calls updateField with 0 when reserve price is cleared", () => {
    render(<PricingDurationStep />);
    const input = screen.getByLabelText(/Reserve Price/i);
    fireEvent.change(input, { target: { value: "" } });
    expect(mockUpdateField).toHaveBeenCalledWith("reservePrice", 0);
  });

  it("calls updateField on duration selection", () => {
    render(<PricingDurationStep />);
    fireEvent.click(screen.getByText("14 DAYS"));
    expect(mockUpdateField).toHaveBeenCalledWith("durationDays", 14);
  });

  it("shows error when reserve price is lower than starting price", () => {
    (useListingWizard as Mock).mockReturnValue({
      formData: { ...mockFormData, startingPrice: 5000, reservePrice: 1000 },
      updateField: mockUpdateField,
    });

    render(<PricingDurationStep />);
    expect(
      screen.getByText(/Reserve price cannot be lower/i)
    ).toBeInTheDocument();
  });
});
