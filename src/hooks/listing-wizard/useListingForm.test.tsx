import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  ListingWizardContext,
  type ListingWizardContextType,
} from "@/components/listing-wizard/context/ListingWizardContextDef";
import { DEFAULT_FORM_DATA } from "@/components/listing-wizard/constants";

import { useListingForm } from "./useListingForm";

const mockSetCurrentStep = vi.fn();

describe("useListingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should validate General Info step (step 0)", () => {
    let currentFormData = { ...DEFAULT_FORM_DATA };
    const currentStepValue = 0;

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardContext.Provider
        value={
          {
            formData: currentFormData,
            currentStep: currentStepValue,
            setCurrentStep: mockSetCurrentStep,
          } as unknown as ListingWizardContextType
        }
      >
        {children}
      </ListingWizardContext.Provider>
    );

    const { result, rerender } = renderHook(() => useListingForm(), {
      wrapper: Wrapper,
    });

    expect(result.current.getStepError(0)).toBe("Title is required");

    currentFormData = { ...DEFAULT_FORM_DATA, title: "Test" };
    rerender();
    expect(result.current.getStepError(0)).toBe("Location is required");

    currentFormData = { ...DEFAULT_FORM_DATA, title: "Test", location: "Loc" };
    rerender();
    // Default year is current year, so we need to set an invalid year to test this
    currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "Loc",
      year: 0,
    };
    rerender();
    expect(result.current.getStepError(0)).toBe("Valid year is required");

    currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "Loc",
      year: 2020,
      operatingHours: -1,
    };
    rerender();
    expect(result.current.getStepError(0)).toBe("Operating hours are required");

    currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "Loc",
      year: 2020,
      operatingHours: 100,
    };
    rerender();
    expect(result.current.getStepError(0)).toBe(null);
  });

  it("should navigate next only if valid", () => {
    const currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "",
    };
    const currentStepValue = 0;

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardContext.Provider
        value={
          {
            formData: currentFormData,
            currentStep: currentStepValue,
            setCurrentStep: mockSetCurrentStep,
          } as unknown as ListingWizardContextType
        }
      >
        {children}
      </ListingWizardContext.Provider>
    );

    const { result } = renderHook(() => useListingForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.next();
    });
    expect(mockSetCurrentStep).not.toHaveBeenCalled();
  });

  it("should navigate next if valid", () => {
    const currentFormData = {
      ...DEFAULT_FORM_DATA,
      title: "Test",
      location: "Loc",
      year: 2020,
      operatingHours: 100,
    };
    const currentStepValue = 0;

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardContext.Provider
        value={
          {
            formData: currentFormData,
            currentStep: currentStepValue,
            setCurrentStep: mockSetCurrentStep,
          } as unknown as ListingWizardContextType
        }
      >
        {children}
      </ListingWizardContext.Provider>
    );

    const { result } = renderHook(() => useListingForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.next();
    });
    expect(mockSetCurrentStep).toHaveBeenCalledWith(1);
  });

  it("should navigate prev", () => {
    const currentFormData = { ...DEFAULT_FORM_DATA };
    const currentStepValue = 1;

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <ListingWizardContext.Provider
        value={
          {
            formData: currentFormData,
            currentStep: currentStepValue,
            setCurrentStep: mockSetCurrentStep,
          } as unknown as ListingWizardContextType
        }
      >
        {children}
      </ListingWizardContext.Provider>
    );

    const { result } = renderHook(() => useListingForm(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.prev();
    });
    expect(mockSetCurrentStep).toHaveBeenCalledWith(0);
  });
});
