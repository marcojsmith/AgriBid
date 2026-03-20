import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";

import { GeneralInfoStep } from "./GeneralInfoStep";
import type { ListingFormData } from "../types";
import type { ListingWizardContextType } from "../context/ListingWizardContextDef";

vi.mock("@/hooks/listing-wizard/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

describe("GeneralInfoStep", () => {
  const mockUpdateField = vi.fn();
  const mockFormData = {
    year: 2020,
    location: "",
    description: "",
    title: "",
    operatingHours: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useListingWizard).mockReturnValue({
      formData: mockFormData as unknown as ListingFormData,
      updateField: mockUpdateField,
    } as unknown as ListingWizardContextType);
  });

  it("renders all fields", () => {
    render(<GeneralInfoStep />);
    expect(screen.getByLabelText(/Manufacturing Year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Equipment Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Listing Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Operating Hours/i)).toBeInTheDocument();
  });

  it("calls updateField on year change", () => {
    render(<GeneralInfoStep />);
    const input = screen.getByLabelText(/Manufacturing Year/i);
    fireEvent.change(input, { target: { value: "2023" } });
    expect(mockUpdateField).toHaveBeenCalledWith("year", 2023);
  });

  it("calls updateField on title change", () => {
    render(<GeneralInfoStep />);
    const input = screen.getByLabelText(/Listing Title/i);
    fireEvent.change(input, { target: { value: "New Tractor" } });
    expect(mockUpdateField).toHaveBeenCalledWith("title", "New Tractor");
  });

  it("calls updateField with 0 when year is cleared", () => {
    render(<GeneralInfoStep />);
    const input = screen.getByLabelText(/Manufacturing Year/i);
    fireEvent.change(input, { target: { value: "" } });
    expect(mockUpdateField).toHaveBeenCalledWith("year", 0);
  });

  it("calls updateField with 0 when operating hours is cleared", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        ...mockFormData,
        operatingHours: 100,
      } as unknown as ListingFormData,
      updateField: mockUpdateField,
    } as unknown as ListingWizardContextType);
    render(<GeneralInfoStep />);
    const input = screen.getByLabelText(/Operating Hours/i);
    fireEvent.change(input, { target: { value: "" } });
    expect(mockUpdateField).toHaveBeenCalledWith("operatingHours", 0);
  });

  it("should not update year if value is too long", () => {
    render(<GeneralInfoStep />);
    const input = screen.getByLabelText(/Manufacturing Year/i);
    fireEvent.change(input, { target: { value: "12345" } });
    expect(mockUpdateField).not.toHaveBeenCalledWith("year", 12345);
  });

  it("shows location suggestions after typing 2 characters", () => {
    const { rerender } = render(<GeneralInfoStep />);
    const input = screen.getByLabelText(/Location/i);

    // Type 2 characters
    fireEvent.change(input, { target: { value: "Jo" } });

    // Mock the updated formData that would come from context
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        ...mockFormData,
        location: "Jo",
      } as unknown as ListingFormData,
      updateField: mockUpdateField,
    } as unknown as ListingWizardContextType);

    rerender(<GeneralInfoStep />);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText(/Johannesburg/i)).toBeInTheDocument();
  });

  it("updates location when suggestion is clicked", () => {
    const { rerender } = render(<GeneralInfoStep />);
    const input = screen.getByLabelText(/Location/i);

    fireEvent.change(input, { target: { value: "Jo" } });

    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        ...mockFormData,
        location: "Jo",
      } as unknown as ListingFormData,
      updateField: mockUpdateField,
    } as unknown as ListingWizardContextType);

    rerender(<GeneralInfoStep />);

    const suggestion = screen.getByText(/Johannesburg/i);
    fireEvent.click(suggestion);

    expect(mockUpdateField).toHaveBeenCalledWith(
      "location",
      expect.stringContaining("Johannesburg")
    );
  });

  it("hides suggestions on blur", () => {
    vi.useFakeTimers();
    const { rerender } = render(<GeneralInfoStep />);
    const input = screen.getByLabelText(/Location/i);

    fireEvent.change(input, { target: { value: "Jo" } });

    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        ...mockFormData,
        location: "Jo",
      } as unknown as ListingFormData,
      updateField: mockUpdateField,
    } as unknown as ListingWizardContextType);

    rerender(<GeneralInfoStep />);

    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.blur(input);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
